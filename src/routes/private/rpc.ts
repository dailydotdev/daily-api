import { Code, ConnectError, ConnectRouter } from '@connectrpc/connect';
import { TypeOrmError, TypeORMQueryFailedError } from '../../errors';
import {
  ArticlePost,
  MachineSource,
  SourceRequest,
  SourceFeed,
  SQUAD_IMAGE_PLACEHOLDER,
  SourceType,
} from '../../entity';
import { generateShortId } from '../../ids';
import createOrGetConnection from '../../db';
import { isValidHttpUrl, standardizeURL } from '../../common/links';
import { baseRpcContext } from '../../common/connectRpc';
import {
  CreatePostRequest,
  CreatePostResponse,
  CreateSourceRequestResponse,
  Source as SourceMessage,
  SourceRequestService,
  PostService,
} from '@dailydotdev/schema';
import { DataSource, FindOptionsWhere } from 'typeorm';
import { logger } from '../../logger';
import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { z } from 'zod';
import { garmScraperService } from '../../common/scraper';
import { uploadLogo } from '../../common';
import {
  AddSourceFeedResponse,
  CreateSourceRequest,
  CreateSourceResponse,
  ScrapeSourceFeed,
  ScrapeSourceRequest,
  ScrapeSourceResponse,
  SourceService,
} from './sourceRpcSchema';

const scraperFeedSchema = z.union([
  z.string(),
  z.object({
    url: z.string().optional(),
    feed: z.string().optional(),
    title: z.string().optional().nullable(),
  }),
]);

const scraperResponseSchema = z.union([
  z.object({
    type: z.literal('unavailable'),
  }),
  z.object({
    type: z.literal(['website', 'rss']),
    name: z.string().optional(),
    logo: z.string().optional(),
    website: z.string().optional(),
    rss: z.array(scraperFeedSchema).optional(),
    rssFeeds: z.array(scraperFeedSchema).optional(),
    rss_feeds: z.array(scraperFeedSchema).optional(),
  }),
]);

type NormalizedScrapeFeed = {
  url: string;
  title?: string;
};

type NormalizedScrapeResponse =
  | {
      type: 'unavailable';
    }
  | {
      type: 'website' | 'rss';
      name?: string;
      logo?: string;
      website?: string;
      feeds: NormalizedScrapeFeed[];
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

const requireServiceAuth = (service?: boolean): void => {
  if (!service) {
    throw new ConnectError('unauthenticated', Code.Unauthenticated);
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

const normalizeScrapeResponse = (
  payload: z.infer<typeof scraperResponseSchema>,
): NormalizedScrapeResponse => {
  if (payload.type === 'unavailable') {
    return payload;
  }

  const rawFeeds = payload.rss ?? payload.rssFeeds ?? payload.rss_feeds ?? [];

  return {
    type: payload.type,
    name: payload.name,
    logo: payload.logo,
    website: payload.website,
    feeds: rawFeeds.flatMap((feed): NormalizedScrapeFeed[] => {
      if (typeof feed === 'string') {
        return [{ url: feed }];
      }

      const url = feed.url ?? feed.feed;
      if (!url) {
        return [];
      }

      return [
        {
          url,
          title: feed.title ?? undefined,
        },
      ];
    }),
  };
};

const toSourceMessage = (source: MachineSource): SourceMessage =>
  new SourceMessage({
    id: source.id,
    type: source.type,
    createdAt: Math.floor(source.createdAt.getTime() / 1000),
    active: source.active,
    name: source.name,
    image: source.image,
    private: source.private,
    headerImage: source.headerImage ?? undefined,
    color: source.color ?? undefined,
    handle: source.handle,
    twitter: source.twitter ?? undefined,
    website: source.website ?? undefined,
    description: source.description ?? undefined,
  });

const uploadSourceImage = async (
  imageUrl: string | undefined,
  sourceId: string,
): Promise<string> => {
  if (!imageUrl) {
    return SQUAD_IMAGE_PLACEHOLDER;
  }

  const response = await fetch(imageUrl);
  if (!response.ok || !response.body) {
    throw new ConnectError('failed to download source image', Code.Internal);
  }

  const stream = Readable.fromWeb(response.body as WebReadableStream);

  return uploadLogo(sourceId, stream);
};

export default function (router: ConnectRouter) {
  router.rpc(PostService, PostService.methods.create, async (req, context) => {
    requireServiceAuth(context.values.get(baseRpcContext).service);

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
      requireServiceAuth(context.values.get(baseRpcContext).service);

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

        return new CreateSourceRequestResponse({
          id: sourceRequest.identifiers[0].id,
        });
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
    SourceService.methods.scrapeSource,
    async (req: ScrapeSourceRequest, context) => {
      requireServiceAuth(context.values.get(baseRpcContext).service);

      const originalReq = req.clone();

      try {
        req.url = standardizeURL(req.url).canonicalUrl;
        if (!isValidHttpUrl(req.url)) {
          throw new ConnectError('invalid url', Code.InvalidArgument);
        }

        const scraperUrl = new URL('/scrape/source', process.env.SCRAPER_URL);
        scraperUrl.searchParams.set('url', req.url);

        const response = await garmScraperService.execute(async () =>
          fetch(scraperUrl),
        );

        if (!response.ok) {
          throw new ConnectError('scraper unavailable', Code.Unavailable);
        }

        const payload = scraperResponseSchema.parse(await response.json());
        const normalized = normalizeScrapeResponse(payload);

        return new ScrapeSourceResponse({
          type: normalized.type,
          name: 'name' in normalized ? normalized.name : undefined,
          logo: 'logo' in normalized ? normalized.logo : undefined,
          website: 'website' in normalized ? normalized.website : undefined,
          feeds:
            'feeds' in normalized
              ? normalized.feeds.map(
                  (feed) =>
                    new ScrapeSourceFeed({
                      url: feed.url,
                      title: feed.title,
                    }),
                )
              : [],
        });
      } catch (originalError) {
        const error = originalError as Error;

        logger.error(
          { err: error, data: originalReq.toJson() },
          'error while scraping source',
        );

        if (error instanceof ConnectError) {
          throw error;
        }

        throw new ConnectError('internal', Code.Internal);
      }
    },
  );

  router.rpc(
    SourceService,
    SourceService.methods.createSource,
    async (req: CreateSourceRequest, context) => {
      requireServiceAuth(context.values.get(baseRpcContext).service);

      const originalReq = req.clone();
      const con = await createOrGetConnection();

      try {
        if (!req.id || !req.name) {
          throw new ConnectError(
            'id and name are required',
            Code.InvalidArgument,
          );
        }

        if (req.website) {
          req.website = standardizeURL(req.website).canonicalUrl;
          if (!isValidHttpUrl(req.website)) {
            throw new ConnectError('invalid website', Code.InvalidArgument);
          }
        }

        if (req.image && !isValidHttpUrl(req.image)) {
          throw new ConnectError('invalid image', Code.InvalidArgument);
        }

        const image = await uploadSourceImage(req.image, req.id);

        const source = await con.manager.transaction(async (entityManager) => {
          const sourceRepo = entityManager.getRepository(MachineSource);
          const sourceEntity = sourceRepo.create({
            id: req.id,
            name: req.name,
            image,
            twitter: req.twitter || undefined,
            website: req.website || undefined,
            handle: req.id,
            type: SourceType.Machine,
          });

          await sourceRepo.insert(sourceEntity);

          return sourceRepo.findOneByOrFail({ id: req.id });
        });

        return new CreateSourceResponse({
          source: toSourceMessage(source),
        });
      } catch (originalError) {
        const error = originalError as TypeORMQueryFailedError;

        logger.error(
          { err: error, data: originalReq.toJson() },
          'error while creating source',
        );

        if (error instanceof ConnectError) {
          throw error;
        }

        if (error?.code === TypeOrmError.DUPLICATE_ENTRY) {
          throw new ConnectError('source already exists', Code.AlreadyExists);
        }

        throw new ConnectError(error.message, Code.Internal);
      }
    },
  );

  router.rpc(
    SourceService,
    SourceService.methods.addSourceFeed,
    async (req, context) => {
      requireServiceAuth(context.values.get(baseRpcContext).service);

      const originalReq = req.clone();
      const con = await createOrGetConnection();

      try {
        if (!req.sourceId || !req.feed) {
          throw new ConnectError(
            'source id and feed are required',
            Code.InvalidArgument,
          );
        }

        if (!isValidHttpUrl(req.feed)) {
          throw new ConnectError('invalid feed', Code.InvalidArgument);
        }

        await con.getRepository(SourceFeed).insert({
          sourceId: req.sourceId,
          feed: req.feed,
        });

        return new AddSourceFeedResponse({
          sourceId: req.sourceId,
          feed: req.feed,
        });
      } catch (originalError) {
        const error = originalError as TypeORMQueryFailedError;

        logger.error(
          { err: error, data: originalReq.toJson() },
          'error while adding source feed',
        );

        if (error instanceof ConnectError) {
          throw error;
        }

        if (error?.code === TypeOrmError.DUPLICATE_ENTRY) {
          throw new ConnectError(
            'source feed already exists',
            Code.AlreadyExists,
          );
        }

        if (
          error?.code === TypeOrmError.FOREIGN_KEY &&
          error?.detail?.includes('source')
        ) {
          throw new ConnectError('source not found', Code.NotFound);
        }

        throw new ConnectError(error.message, Code.Internal);
      }
    },
  );
}
