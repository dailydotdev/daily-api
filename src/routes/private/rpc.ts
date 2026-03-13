import { randomUUID } from 'node:crypto';
import { Readable } from 'stream';
import { Code, ConnectError, ConnectRouter } from '@connectrpc/connect';
import { DataSource, FindOptionsWhere } from 'typeorm';
import {
  CreatePostRequest,
  CreatePostResponse,
  PageIngestion,
  PostService,
  ProvisionSourceRequest,
  ProvisionSourceResponse,
  ProvisionedIngestion,
  RssNewsletterIngestion,
  Source as RpcSource,
  SourceEngine,
  SourceRequestService,
  SourceService,
} from '@dailydotdev/schema';
import {
  ArticlePost,
  MachineSource,
  SourceFeed,
  SourceRequest,
  SourceType,
} from '../../entity';
import { getSecondsTimestamp, uploadLogo } from '../../common';
import { baseRpcContext } from '../../common/connectRpc';
import { isValidHttpUrl, standardizeURL } from '../../common/links';
import createOrGetConnection from '../../db';
import { TypeOrmError, TypeORMQueryFailedError } from '../../errors';
import { fetchOptions as globalFetchOptions } from '../../http';
import { generateShortId } from '../../ids';
import { retryFetch, retryFetchParse } from '../../integrations/retry';
import { logger } from '../../logger';
import { pubsub } from '../../common/pubsub';

const defaultSelectorEvaluator =
  '(selector) => Array.from(document.querySelectorAll(selector)).map((el) => el.href)';

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

type TwitterUser = {
  id: string;
  name: string;
  username: string;
  profile_image_url?: string;
};

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
  sourceFeedUrl?: string;
};

type ProvisionSourceData = {
  name: string;
  image?: string;
  twitter?: string;
  website?: string;
};

const getDuplicatePost = async ({
  req,
  con,
}: {
  req: CreatePostRequest;
  con: DataSource;
}): Promise<CreatePostResponse> | never => {
  try {
    const existingFindBy: FindOptionsWhere<ArticlePost> = {};

    if (req.yggdrasilId) {
      existingFindBy.yggdrasilId = req.yggdrasilId;
    } else {
      existingFindBy.url = req.url;
    }

    const existingPost = await con
      .getRepository(ArticlePost)
      .findOneByOrFail(existingFindBy);

    return new CreatePostResponse({
      postId: existingPost.id,
      url: existingPost.url || undefined,
    });
  } catch (error) {
    logger.error({ err: error }, 'error while getting duplicate post');

    throw new ConnectError('internal', Code.Internal);
  }
};

const validateCreatePostRequest = (req: CreatePostRequest): never | void => {
  if (req.sourceId === 'collections') {
    if (!req.yggdrasilId) {
      throw new ConnectError(
        'yggdrasil id required for collections',
        Code.InvalidArgument,
      );
    }

    return;
  }

  if (!isValidHttpUrl(req.url)) {
    throw new ConnectError('invalid url', Code.InvalidArgument);
  }
};

const normalizeOptionalUrl = (value?: string): string | undefined =>
  value ? standardizeURL(value).url : undefined;

const normalizeTwitterUsername = (username?: string): string =>
  username?.trim().replace(/^@/, '').toLowerCase() || '';

const validateProvisionRequest = (
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
        sourceFeedUrl: url,
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
        sourceFeedUrl: url,
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
        sourceFeedUrl: url,
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
        sourceFeedUrl: url,
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
      const threshold = req.ingestion.value.audienceFitThreshold ?? 0.4;
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
  const scrapeUrl = new URL('/scrape/source', process.env.SCRAPER_URL);
  scrapeUrl.searchParams.set('url', url);

  return retryFetchParse<ScrapeSourceResponse>(
    scrapeUrl,
    {
      ...globalFetchOptions,
      method: 'GET',
    },
    { retries: 1 },
  );
};

const uploadRemoteLogo = async (url: string): Promise<string> => {
  if (url.includes('/logos/placeholder.jpg')) {
    return url;
  }

  const response = await retryFetch(
    url,
    {
      ...globalFetchOptions,
      method: 'GET',
    },
    { retries: 1 },
  );

  if (!response.body) {
    throw new ConnectError('failed to download image', Code.Internal);
  }

  return uploadLogo(
    randomUUID().replace(/-/g, ''),
    response.body as unknown as Readable,
  );
};

const fetchTwitterProfile = async (username: string): Promise<TwitterUser> => {
  const token = process.env.TWITTER_BEARER_TOKEN;
  if (!token) {
    throw new ConnectError(
      'twitter bearer token not configured',
      Code.FailedPrecondition,
    );
  }

  const response = await retryFetch(
    `https://api.x.com/2/users/by/username/${encodeURIComponent(username)}?user.fields=profile_image_url,name`,
    {
      ...globalFetchOptions,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    { retries: 1 },
  );
  const payload = (await response.json()) as {
    data?: TwitterUser;
  };

  if (!payload.data) {
    throw new ConnectError('twitter user not found', Code.NotFound);
  }

  return payload.data;
};

const resolveProvisionSourceData = async ({
  req,
  plan,
}: {
  req: ProvisionSourceRequest;
  plan: ProvisionPlan;
}): Promise<ProvisionSourceData> => {
  if (req.ingestion.case === 'twitterAccount') {
    const profile = await fetchTwitterProfile(plan.ingestion.twitterUsername);

    return {
      name: req.name || profile.name,
      image:
        req.image ||
        (profile.profile_image_url
          ? await uploadRemoteLogo(
              profile.profile_image_url.replace('_normal', '_400x400'),
            )
          : undefined),
      twitter: profile.username,
      website: normalizeOptionalUrl(req.website),
    };
  }

  const baseData: ProvisionSourceData = {
    name: req.name || req.sourceId,
    image: req.image,
    twitter: req.twitter,
    website: normalizeOptionalUrl(req.website),
  };

  if (!req.scrapeMetadata || !plan.scrapeUrl) {
    return baseData;
  }

  const scraped = await scrapeSource(standardizeURL(plan.scrapeUrl).url);
  if (scraped.type === 'unavailable') {
    throw new ConnectError(
      'failed to scrape source metadata',
      Code.Unavailable,
    );
  }

  return {
    name:
      req.name ||
      (scraped.type === 'website' && scraped.name
        ? scraped.name
        : req.sourceId),
    image:
      req.image ||
      (scraped.type === 'website' && scraped.logo
        ? await uploadRemoteLogo(scraped.logo)
        : undefined),
    twitter: req.twitter,
    website: normalizeOptionalUrl(req.website) || scraped.website,
  };
};

const saveProvisionedSource = async ({
  con,
  req,
  plan,
  sourceData,
}: {
  con: DataSource;
  req: ProvisionSourceRequest;
  plan: ProvisionPlan;
  sourceData: ProvisionSourceData;
}): Promise<MachineSource> =>
  con.manager.transaction(async (entityManager) => {
    const source = await entityManager.getRepository(MachineSource).save({
      id: req.sourceId,
      handle: req.sourceId,
      name: sourceData.name,
      ...(sourceData.image ? { image: sourceData.image } : {}),
      ...(sourceData.twitter ? { twitter: sourceData.twitter } : {}),
      ...(sourceData.website ? { website: sourceData.website } : {}),
    });

    if (plan.sourceFeedUrl) {
      await entityManager.getRepository(SourceFeed).save({
        sourceId: source.id,
        feed: plan.sourceFeedUrl,
      });
    }

    return source;
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

export default function (router: ConnectRouter) {
  router.rpc(PostService, PostService.methods.create, async (req, context) => {
    if (!context.values.get(baseRpcContext).service) {
      throw new ConnectError('unauthenticated', Code.Unauthenticated);
    }

    const originalReq = req.clone();
    const con = await createOrGetConnection();

    try {
      req.url = standardizeURL(req.url).url;

      validateCreatePostRequest(req);

      const postId = await generateShortId();
      const postEntity = con.getRepository(ArticlePost).create({
        ...req,
        url: req.url || null,
        id: postId,
        shortId: postId,
        visible: false,
        showOnFeed: false,
      });
      const newPost = await con.getRepository(ArticlePost).insert(postEntity);

      return new CreatePostResponse({
        postId: newPost.identifiers[0].id,
        url: req.url,
      });
    } catch (originalError) {
      const error = originalError as TypeORMQueryFailedError;

      logger.error(
        { err: error, data: originalReq.toJson() },
        'error while creating post',
      );

      if (error instanceof ConnectError) {
        throw error;
      }

      if (error?.code === TypeOrmError.DUPLICATE_ENTRY) {
        return await getDuplicatePost({ req, con });
      }

      if (
        error?.code === TypeOrmError.FOREIGN_KEY &&
        error?.detail?.includes('source')
      ) {
        throw new ConnectError('source not found', Code.NotFound);
      }

      throw new ConnectError(error.message, Code.Internal);
    }
  });

  router.rpc(
    SourceRequestService,
    SourceRequestService.methods.create,
    async (req, context) => {
      if (!context.values.get(baseRpcContext).service) {
        throw new ConnectError('unauthenticated', Code.Unauthenticated);
      }

      const originalReq = req.clone();
      const con = await createOrGetConnection();

      try {
        req.url = standardizeURL(req.url).canonicalUrl;
        if (!isValidHttpUrl(req.url)) {
          throw new ConnectError('invalid url', Code.InvalidArgument);
        }

        const sourceRequest = await con.getRepository(SourceRequest).insert({
          sourceUrl: req.url,
          userId: 'yggdrasil',
          userName: 'Yggdrasil bot',
          userEmail: 'yggdrasil@daily.dev',
        });

        return {
          id: sourceRequest.identifiers[0].id,
        };
      } catch (originalError) {
        const error = originalError as TypeORMQueryFailedError;

        logger.error(
          { err: error, data: originalReq.toJson() },
          'error while creating source request',
        );

        if (error instanceof ConnectError) {
          throw error;
        }

        throw new ConnectError(error.message, Code.Internal);
      }
    },
  );

  router.rpc(
    SourceService,
    SourceService.methods.provision,
    async (req, context) => {
      if (!context.values.get(baseRpcContext).service) {
        throw new ConnectError('unauthenticated', Code.Unauthenticated);
      }

      validateProvisionRequest(req);

      const con = await createOrGetConnection();
      const plan = buildProvisionPlan(req);
      const sourceData = await resolveProvisionSourceData({ req, plan });
      const source = await saveProvisionedSource({
        con,
        req,
        plan,
        sourceData,
      });

      await pubsub.topic('source-added').publishMessage({
        json: plan.publishMessage,
      });

      return new ProvisionSourceResponse({
        source: toRpcSource(source),
        ingestion: plan.ingestion,
      });
    },
  );
}
