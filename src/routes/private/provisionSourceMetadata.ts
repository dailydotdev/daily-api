import { Code, ConnectError } from '@connectrpc/connect';
import { ProvisionSourceRequest } from '@dailydotdev/schema';
import { fetchOptions as globalFetchOptions } from '../../http';
import { uploadLogoFromUrl } from '../../common';
import { retryFetchParse, type RetryOptions } from '../../integrations/retry';
import {
  fetchBrandProfile,
  getBrandDevDomain,
  pickBrandDevLogo,
} from '../../integrations/brand/profile';
import { fetchTwitterProfile } from '../../integrations/twitter/profile';
import {
  normalizeOptionalTwitterUsername,
  normalizeOptionalUrl,
  normalizeTwitterUsername,
} from './provisionSourcePlan';
import {
  PartialProvisionSourceData,
  placeholderLogoPath,
  ProvisionSourceData,
  ScrapeSourceResponse,
} from './provisionSourceTypes';

const unstableExternalRetryOptions: RetryOptions = {
  retries: 3,
};

const getScraperUrl = (): string => {
  const scraperUrl = process.env.SCRAPER_URL;
  if (!scraperUrl) {
    throw new ConnectError(
      'scraper url not configured',
      Code.FailedPrecondition,
    );
  }

  return scraperUrl;
};

const scrapeSource = async (url: string): Promise<ScrapeSourceResponse> => {
  const scrapeUrl = new URL('/scrape/source', getScraperUrl());
  scrapeUrl.searchParams.set('url', url);

  return retryFetchParse<ScrapeSourceResponse>(
    scrapeUrl,
    {
      ...globalFetchOptions,
      method: 'GET',
    },
    unstableExternalRetryOptions,
  );
};

const uploadRemoteLogo = async ({
  sourceId,
  url,
}: {
  sourceId: string;
  url: string;
}): Promise<string> => {
  if (url.includes(placeholderLogoPath)) {
    return url;
  }

  return uploadLogoFromUrl(sourceId, url);
};

const buildRequestedSourceData = (
  req: ProvisionSourceRequest,
): ProvisionSourceData => ({
  name: req.name || req.sourceId,
  image: req.image,
  twitter: normalizeOptionalTwitterUsername(req.twitter),
  website: normalizeOptionalUrl(req.website),
});

const mergeResolvedSourceData = ({
  req,
  scrapedData,
  brandDevData,
}: {
  req: ProvisionSourceRequest;
  scrapedData?: PartialProvisionSourceData;
  brandDevData?: PartialProvisionSourceData;
}): ProvisionSourceData => ({
  name: req.name || scrapedData?.name || brandDevData?.name || req.sourceId,
  image: req.image || scrapedData?.image || brandDevData?.image,
  twitter: normalizeOptionalTwitterUsername(req.twitter),
  website:
    normalizeOptionalUrl(req.website) ||
    scrapedData?.website ||
    brandDevData?.website,
});

const resolveTwitterSourceData = async (
  req: ProvisionSourceRequest & {
    ingestion: { case: 'twitterAccount'; value: { username: string } };
  },
): Promise<ProvisionSourceData> => {
  const profile = await fetchTwitterProfile(
    normalizeTwitterUsername(req.ingestion.value.username),
  );

  return {
    name: req.name || profile.name,
    image:
      req.image ||
      (profile.profile_image_url
        ? await uploadRemoteLogo({
            sourceId: req.sourceId,
            url: profile.profile_image_url.replace('_normal', '_400x400'),
          })
        : undefined),
    twitter: profile.username,
    website: normalizeOptionalUrl(req.website),
  };
};

const shouldUseBrandDev = (req: ProvisionSourceRequest): boolean =>
  req.ingestion.case !== 'twitterAccount' &&
  req.ingestion.case !== 'youtubeChannel';

const resolveBrandDevSourceData = async ({
  req,
  candidates,
}: {
  req: ProvisionSourceRequest;
  candidates: Array<string | undefined>;
}): Promise<PartialProvisionSourceData | undefined> => {
  const domain = candidates.map(getBrandDevDomain).find(Boolean);
  if (!domain) {
    return undefined;
  }

  const brand = await fetchBrandProfile(domain);
  if (!brand) {
    return undefined;
  }

  const logoUrl = pickBrandDevLogo(brand.logos);

  return {
    name: req.name || brand.title || undefined,
    image:
      req.image ||
      (logoUrl
        ? await uploadRemoteLogo({
            sourceId: req.sourceId,
            url: logoUrl,
          })
        : undefined),
    website:
      normalizeOptionalUrl(req.website) ||
      normalizeOptionalUrl(brand.links?.home) ||
      (brand.domain ? `https://${brand.domain}` : undefined),
  };
};

const resolveScrapedWebsiteData = async ({
  req,
  scrapeUrl,
}: {
  req: ProvisionSourceRequest;
  scrapeUrl: string;
}): Promise<{
  failed: boolean;
  scrapedData: PartialProvisionSourceData;
  scrapedWebsite?: string;
}> => {
  try {
    const scraped = await scrapeSource(scrapeUrl);
    if (scraped.type === 'unavailable') {
      return {
        failed: true,
        scrapedData: {},
      };
    }

    const scrapedWebsite = scraped.website
      ? normalizeOptionalUrl(scraped.website)
      : undefined;

    return {
      failed: false,
      scrapedWebsite,
      scrapedData: {
        name:
          req.name ||
          (scraped.type === 'website' ? scraped.name || undefined : undefined),
        image:
          req.image ||
          (scraped.type === 'website' && scraped.logo
            ? await uploadRemoteLogo({
                sourceId: req.sourceId,
                url: scraped.logo,
              })
            : undefined),
        website: normalizeOptionalUrl(req.website) || scrapedWebsite,
      },
    };
  } catch {
    return {
      failed: true,
      scrapedData: {},
    };
  }
};

const resolveScrapedSourceData = async ({
  req,
  scrapeUrl,
}: {
  req: ProvisionSourceRequest;
  scrapeUrl: string;
}): Promise<ProvisionSourceData> => {
  const normalizedScrapeUrl = normalizeOptionalUrl(scrapeUrl);
  if (!normalizedScrapeUrl) {
    throw new ConnectError('invalid scrape url', Code.InvalidArgument);
  }

  const scrapedResult = await resolveScrapedWebsiteData({
    req,
    scrapeUrl: normalizedScrapeUrl,
  });

  const needsBrandFallback =
    shouldUseBrandDev(req) &&
    (scrapedResult.failed ||
      !scrapedResult.scrapedData.name ||
      !scrapedResult.scrapedData.image ||
      !scrapedResult.scrapedData.website);

  const brandDevData = needsBrandFallback
    ? await resolveBrandDevSourceData({
        req,
        candidates: [
          req.website,
          scrapedResult.scrapedWebsite,
          normalizedScrapeUrl,
        ],
      })
    : undefined;

  if (scrapedResult.failed && !brandDevData) {
    throw new ConnectError(
      'failed to scrape source metadata',
      Code.Unavailable,
    );
  }

  return mergeResolvedSourceData({
    req,
    scrapedData: scrapedResult.scrapedData,
    brandDevData,
  });
};

export const resolveProvisionSourceData = async ({
  req,
  scrapeUrl,
}: {
  req: ProvisionSourceRequest;
  scrapeUrl?: string;
}): Promise<ProvisionSourceData> => {
  if (req.ingestion.case === 'twitterAccount') {
    return resolveTwitterSourceData(
      req as ProvisionSourceRequest & {
        ingestion: { case: 'twitterAccount'; value: { username: string } };
      },
    );
  }

  if (!req.scrapeMetadata || !scrapeUrl) {
    return buildRequestedSourceData(req);
  }

  return resolveScrapedSourceData({
    req,
    scrapeUrl,
  });
};
