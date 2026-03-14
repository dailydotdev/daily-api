import { Readable } from 'stream';
import { Code, ConnectError } from '@connectrpc/connect';
import { DataSource } from 'typeorm';
import {
  PageIngestion,
  ProvisionSourceRequest,
  ProvisionSourceResponse,
  ProvisionedIngestion,
  RssNewsletterIngestion,
  Source as RpcSource,
  SourceEngine,
} from '@dailydotdev/schema';
import { MachineSource, SourceType } from '../../entity';
import { getSecondsTimestamp, uploadLogo } from '../../common';
import { isValidHttpUrl, standardizeURL } from '../../common/links';
import { pubsub } from '../../common/pubsub';
import { fetchOptions as globalFetchOptions } from '../../http';
import {
  retryFetch,
  retryFetchParse,
  type RetryOptions,
} from '../../integrations/retry';
import {
  fetchBrandProfile,
  getBrandDevDomain,
  pickBrandDevLogo,
} from '../../integrations/brand/profile';
import {
  downloadTwitterProfileImage,
  fetchTwitterProfile,
} from '../../integrations/twitter/profile';

const defaultSelectorEvaluator =
  '(selector) => Array.from(document.querySelectorAll(selector)).map((el) => el.href)';
const placeholderLogoPath = '/logos/placeholder.jpg';
const defaultAudienceFitThreshold = 0.4;
const unstableExternalRetryOptions: RetryOptions = {
  retries: 3,
};

type ScrapeSourceWebsite = {
  type: 'website';
  website?: string;
  rss: { title?: string; url: string }[];
  logo?: string;
  name?: string;
};

type ScrapeSourceRss = {
  type: 'rss';
  rss: string;
  website: string;
};

type ScrapeSourceUnavailable = {
  type: 'unavailable';
};

type ScrapeSourceResponse =
  | ScrapeSourceWebsite
  | ScrapeSourceRss
  | ScrapeSourceUnavailable;

type SourceAddedMessage = {
  url: string;
  source_id: string;
  engine_id: string;
  status?: string;
  options?: Record<string, unknown>;
};

type ProvisionPlan = {
  ingestion: ProvisionedIngestion;
  publishMessage: SourceAddedMessage;
  scrapeUrl?: string;
};

type ProvisionSourceData = {
  name: string;
  image?: string;
  twitter?: string;
  website?: string;
};

type PartialProvisionSourceData = Partial<ProvisionSourceData>;

const normalizeOptionalUrl = (value?: string): string | undefined =>
  value ? standardizeURL(value).url : undefined;

const normalizeTwitterUsername = (username?: string): string =>
  username?.trim().replace(/^@/, '').toLowerCase() || '';

const normalizeOptionalTwitterUsername = (
  username?: string,
): string | undefined => {
  const normalized = normalizeTwitterUsername(username);
  return normalized || undefined;
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

export const validateProvisionRequest = (
  req: ProvisionSourceRequest,
): never | void => {
  if (!req.sourceId) {
    throw new ConnectError('source id required', Code.InvalidArgument);
  }

  if (req.website && !isValidHttpUrl(req.website)) {
    throw new ConnectError('invalid website', Code.InvalidArgument);
  }

  if (req.image && !isValidHttpUrl(req.image)) {
    throw new ConnectError('invalid image', Code.InvalidArgument);
  }

  switch (req.ingestion.case) {
    case 'rss':
      if (!isValidHttpUrl(req.ingestion.value.feedUrl)) {
        throw new ConnectError('invalid feed url', Code.InvalidArgument);
      }
      return;
    case 'youtubeChannel':
      if (!isValidHttpUrl(req.ingestion.value.channelUrl)) {
        throw new ConnectError('invalid channel url', Code.InvalidArgument);
      }
      return;
    case 'rssNewsletter':
      if (!isValidHttpUrl(req.ingestion.value.feedUrl)) {
        throw new ConnectError('invalid feed url', Code.InvalidArgument);
      }
      return;
    case 'page':
      if (!isValidHttpUrl(req.ingestion.value.pageUrl)) {
        throw new ConnectError('invalid page url', Code.InvalidArgument);
      }
      return;
    case 'twitterAccount':
      if (!normalizeTwitterUsername(req.ingestion.value.username)) {
        throw new ConnectError(
          'invalid twitter username',
          Code.InvalidArgument,
        );
      }
      return;
    default:
      throw new ConnectError('ingestion required', Code.InvalidArgument);
  }
};

const buildSelectorOptions = (
  extraction?:
    | PageIngestion['extraction']
    | RssNewsletterIngestion['extraction'],
): { selector?: string; evaluator?: string } | undefined => {
  if (!extraction) {
    return undefined;
  }

  const selector = extraction.selector;
  const evaluator =
    extraction.evaluator || (selector ? defaultSelectorEvaluator : undefined);

  if (!selector && !evaluator) {
    return undefined;
  }

  return {
    selector,
    evaluator,
  };
};

const buildProvisionPlan = (req: ProvisionSourceRequest): ProvisionPlan => {
  switch (req.ingestion.case) {
    case 'rss': {
      const url = standardizeURL(req.ingestion.value.feedUrl).url;
      return {
        ingestion: new ProvisionedIngestion({
          engine: SourceEngine.RSS,
          url,
        }),
        scrapeUrl: req.website || url,
        publishMessage: {
          url,
          source_id: req.sourceId,
          engine_id: 'rss',
        },
      };
    }
    case 'youtubeChannel': {
      const url = standardizeURL(req.ingestion.value.channelUrl).url;
      return {
        ingestion: new ProvisionedIngestion({
          engine: SourceEngine.YOUTUBE_CHANNEL,
          url,
        }),
        scrapeUrl: req.website || url,
        publishMessage: {
          url,
          source_id: req.sourceId,
          engine_id: 'youtube:channel',
        },
      };
    }
    case 'rssNewsletter': {
      const url = standardizeURL(req.ingestion.value.feedUrl).url;
      const options = buildSelectorOptions(req.ingestion.value.extraction);

      return {
        ingestion: new ProvisionedIngestion({
          engine: SourceEngine.RSS_NEWSLETTER,
          url,
          selector: options?.selector,
          evaluator: options?.evaluator,
        }),
        scrapeUrl: req.website || url,
        publishMessage: {
          url,
          source_id: req.sourceId,
          engine_id: 'rss_newsletter',
          ...(options ? { options } : {}),
        },
      };
    }
    case 'page': {
      const url = standardizeURL(req.ingestion.value.pageUrl).url;
      const options = buildSelectorOptions(req.ingestion.value.extraction);

      return {
        ingestion: new ProvisionedIngestion({
          engine: SourceEngine.PAGE,
          url,
          selector: options?.selector,
          evaluator: options?.evaluator,
        }),
        scrapeUrl: req.website || url,
        publishMessage: {
          url,
          source_id: req.sourceId,
          engine_id: 'page',
          ...(options ? { options } : {}),
        },
      };
    }
    case 'twitterAccount': {
      const username = normalizeTwitterUsername(req.ingestion.value.username);
      const threshold =
        req.ingestion.value.audienceFitThreshold ?? defaultAudienceFitThreshold;
      const url = `https://x.com/${username}`;

      return {
        ingestion: new ProvisionedIngestion({
          engine: SourceEngine.TWITTER_ACCOUNT,
          url,
          twitterUsername: username,
          audienceFitThreshold: threshold,
        }),
        publishMessage: {
          url,
          source_id: req.sourceId,
          engine_id: 'twitter:account',
          status: 'processing',
          options: {
            twitter_account: {
              username,
            },
            audience_fit: {
              threshold,
            },
          },
        },
      };
    }
    default:
      throw new ConnectError('ingestion required', Code.InvalidArgument);
  }
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

const downloadRemoteStream = async (url: string): Promise<Readable> => {
  const response = await retryFetch(
    url,
    {
      ...globalFetchOptions,
      method: 'GET',
    },
    unstableExternalRetryOptions,
  );

  if (!response.body) {
    throw new ConnectError('failed to download image', Code.Internal);
  }

  return response.body as Readable;
};

const uploadRemoteLogo = async ({
  sourceId,
  url,
  stream,
}: {
  sourceId: string;
  url: string;
  stream?: Readable;
}): Promise<string> => {
  if (url.includes(placeholderLogoPath)) {
    return url;
  }

  return uploadLogo(sourceId, stream || (await downloadRemoteStream(url)));
};

const resolveTwitterSourceData = async ({
  req,
  username,
}: {
  req: ProvisionSourceRequest;
  username: string;
}): Promise<ProvisionSourceData> => {
  const profile = await fetchTwitterProfile(username);

  return {
    name: req.name || profile.name,
    image:
      req.image ||
      (profile.profile_image_url
        ? await uploadRemoteLogo({
            sourceId: req.sourceId,
            url: profile.profile_image_url,
            stream: await downloadTwitterProfileImage(
              profile.profile_image_url,
            ),
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

const resolveScrapedSourceData = async ({
  req,
  scrapeUrl,
}: {
  req: ProvisionSourceRequest;
  scrapeUrl: string;
}): Promise<ProvisionSourceData> => {
  const normalizedScrapeUrl = standardizeURL(scrapeUrl).url;
  const canUseBrandDev = shouldUseBrandDev(req);
  let scraperFailed = false;
  let scrapedWebsite: string | undefined;
  let scrapedData: PartialProvisionSourceData = {};

  try {
    const scraped = await scrapeSource(normalizedScrapeUrl);
    if (scraped.type === 'unavailable') {
      scraperFailed = true;
    } else {
      scrapedWebsite = scraped.website
        ? standardizeURL(scraped.website).url
        : undefined;
      scrapedData = {
        name:
          req.name ||
          (scraped.type === 'website' && scraped.name
            ? scraped.name
            : undefined),
        image:
          req.image ||
          (scraped.type === 'website' && scraped.logo
            ? await uploadRemoteLogo({
                sourceId: req.sourceId,
                url: scraped.logo,
              })
            : undefined),
        website: normalizeOptionalUrl(req.website) || scrapedWebsite,
      };
    }
  } catch {
    scraperFailed = true;
  }

  const needsBrandFallback =
    canUseBrandDev &&
    (scraperFailed ||
      !scrapedData.name ||
      !scrapedData.image ||
      !scrapedData.website);
  const brandDevData = needsBrandFallback
    ? await resolveBrandDevSourceData({
        req,
        candidates: [req.website, scrapedWebsite, normalizedScrapeUrl],
      })
    : undefined;

  if (scraperFailed && !brandDevData) {
    throw new ConnectError(
      'failed to scrape source metadata',
      Code.Unavailable,
    );
  }

  return {
    name: req.name || scrapedData.name || brandDevData?.name || req.sourceId,
    image: req.image || scrapedData.image || brandDevData?.image,
    twitter: normalizeOptionalTwitterUsername(req.twitter),
    website:
      normalizeOptionalUrl(req.website) ||
      scrapedData.website ||
      brandDevData?.website,
  };
};

const resolveProvisionSourceData = async ({
  req,
  plan,
}: {
  req: ProvisionSourceRequest;
  plan: ProvisionPlan;
}): Promise<ProvisionSourceData> => {
  if (req.ingestion.case === 'twitterAccount') {
    return resolveTwitterSourceData({
      req,
      username: plan.ingestion.twitterUsername,
    });
  }

  const baseData: ProvisionSourceData = {
    name: req.name || req.sourceId,
    image: req.image,
    twitter: normalizeOptionalTwitterUsername(req.twitter),
    website: normalizeOptionalUrl(req.website),
  };

  if (!req.scrapeMetadata || !plan.scrapeUrl) {
    return baseData;
  }

  return resolveScrapedSourceData({
    req,
    scrapeUrl: plan.scrapeUrl,
  });
};

const saveProvisionedSource = async ({
  con,
  req,
  sourceData,
}: {
  con: DataSource;
  req: ProvisionSourceRequest;
  sourceData: ProvisionSourceData;
}): Promise<MachineSource> =>
  con.getRepository(MachineSource).save({
    id: req.sourceId,
    handle: req.sourceId,
    name: sourceData.name,
    ...(sourceData.image ? { image: sourceData.image } : {}),
    ...(sourceData.twitter ? { twitter: sourceData.twitter } : {}),
    ...(sourceData.website ? { website: sourceData.website } : {}),
  });

const toRpcSource = (source: MachineSource): RpcSource =>
  new RpcSource({
    id: source.id,
    type: SourceType.Machine,
    createdAt: getSecondsTimestamp(source.createdAt),
    active: source.active,
    name: source.name,
    image: source.image,
    private: source.private,
    handle: source.handle,
    twitter: source.twitter,
    website: source.website,
    description: source.description,
  });

export const provisionSource = async (
  req: ProvisionSourceRequest,
  con: DataSource,
): Promise<ProvisionSourceResponse> => {
  validateProvisionRequest(req);

  const plan = buildProvisionPlan(req);
  const sourceData = await resolveProvisionSourceData({ req, plan });
  const source = await saveProvisionedSource({
    con,
    req,
    sourceData,
  });

  await pubsub.topic('source-added').publishMessage({
    json: plan.publishMessage,
  });

  return new ProvisionSourceResponse({
    source: toRpcSource(source),
    ingestion: plan.ingestion,
  });
};
