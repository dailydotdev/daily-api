import { Code, ConnectError, ConnectRouter } from '@connectrpc/connect';
import { DataSource, FindOptionsWhere } from 'typeorm';
import {
  CreatePostRequest,
  CreatePostResponse,
  PostService,
  SourceRequestService,
  SourceService,
} from '@dailydotdev/schema';
import { ArticlePost, SourceRequest } from '../../entity';
import { baseRpcContext } from '../../common/connectRpc';
import { isValidHttpUrl, standardizeURL } from '../../common/links';
import createOrGetConnection from '../../db';
import { TypeOrmError, TypeORMQueryFailedError } from '../../errors';
import { generateShortId } from '../../ids';
import { logger } from '../../logger';
import { provisionSource } from './provisionSource';

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

      logger.error(
        { err: error, data: originalReq.toJson() },
        'error while creating post',
      );

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

      const con = await createOrGetConnection();
      return provisionSource(req, con);
    },
  );
}
