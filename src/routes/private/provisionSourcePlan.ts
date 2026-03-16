import { Code, ConnectError } from '@connectrpc/connect';
import {
  PageIngestion,
  ProvisionSourceRequest,
  ProvisionedIngestion,
  RssNewsletterIngestion,
  SourceEngine,
} from '@dailydotdev/schema';
import {
  defaultAudienceFitThreshold,
  defaultSelectorEvaluator,
  ProvisionPlan,
  SourceAddedMessage,
} from './provisionSourceTypes';
import { isValidHttpUrl, standardizeURL } from '../../common/links';

export const normalizeOptionalUrl = (value?: string): string | undefined =>
  value ? standardizeURL(value).url : undefined;

export const normalizeTwitterUsername = (username?: string): string =>
  username?.trim().replace(/^@/, '').toLowerCase() || '';

export const normalizeOptionalTwitterUsername = (
  username?: string,
): string | undefined => {
  const normalized = normalizeTwitterUsername(username);
  return normalized || undefined;
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

const requireValidUrl = (value: string, message: string): void => {
  if (!isValidHttpUrl(value)) {
    throw new ConnectError(message, Code.InvalidArgument);
  }
};

const createPlan = ({
  req,
  url,
  engine,
  engineId,
  options,
}: {
  req: ProvisionSourceRequest;
  url: string;
  engine: SourceEngine;
  engineId: string;
  options?: Record<string, unknown>;
}): ProvisionPlan => ({
  ingestion: new ProvisionedIngestion({
    engine,
    url,
    ...(options?.selector ? { selector: options.selector as string } : {}),
    ...(options?.evaluator ? { evaluator: options.evaluator as string } : {}),
  }),
  scrapeUrl: req.website || url,
  publishMessage: {
    url,
    source_id: req.sourceId,
    engine_id: engineId,
    ...(options ? { options } : {}),
  },
});

export const validateProvisionRequest = (
  req: ProvisionSourceRequest,
): never | void => {
  if (!req.sourceId) {
    throw new ConnectError('source id required', Code.InvalidArgument);
  }

  if (req.website) {
    requireValidUrl(req.website, 'invalid website');
  }

  if (req.image) {
    requireValidUrl(req.image, 'invalid image');
  }

  switch (req.ingestion.case) {
    case 'rss':
      requireValidUrl(req.ingestion.value.feedUrl, 'invalid feed url');
      return;
    case 'youtubeChannel':
      requireValidUrl(req.ingestion.value.channelUrl, 'invalid channel url');
      return;
    case 'rssNewsletter':
      requireValidUrl(req.ingestion.value.feedUrl, 'invalid feed url');
      return;
    case 'page':
      requireValidUrl(req.ingestion.value.pageUrl, 'invalid page url');
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

const buildTwitterPlan = (
  req: ProvisionSourceRequest & {
    ingestion: { case: 'twitterAccount'; value: { username: string } };
  },
): ProvisionPlan => {
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
    } satisfies SourceAddedMessage,
  };
};

export const buildProvisionPlan = (
  req: ProvisionSourceRequest,
): ProvisionPlan => {
  switch (req.ingestion.case) {
    case 'rss':
      return createPlan({
        req,
        url: standardizeURL(req.ingestion.value.feedUrl).url,
        engine: SourceEngine.RSS,
        engineId: 'rss',
      });
    case 'youtubeChannel':
      return createPlan({
        req,
        url: standardizeURL(req.ingestion.value.channelUrl).url,
        engine: SourceEngine.YOUTUBE_CHANNEL,
        engineId: 'youtube:channel',
      });
    case 'rssNewsletter': {
      const options = buildSelectorOptions(req.ingestion.value.extraction);
      return createPlan({
        req,
        url: standardizeURL(req.ingestion.value.feedUrl).url,
        engine: SourceEngine.RSS_NEWSLETTER,
        engineId: 'rss_newsletter',
        options,
      });
    }
    case 'page': {
      const options = buildSelectorOptions(req.ingestion.value.extraction);
      return createPlan({
        req,
        url: standardizeURL(req.ingestion.value.pageUrl).url,
        engine: SourceEngine.PAGE,
        engineId: 'page',
        options,
      });
    }
    case 'twitterAccount':
      return buildTwitterPlan(
        req as ProvisionSourceRequest & {
          ingestion: { case: 'twitterAccount'; value: { username: string } };
        },
      );
    default:
      throw new ConnectError('ingestion required', Code.InvalidArgument);
  }
};
