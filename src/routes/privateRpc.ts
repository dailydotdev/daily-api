import { Code, ConnectError, ConnectRouter } from '@connectrpc/connect';
import { TypeOrmError } from '../errors';
import { ArticlePost } from '../entity';
import { generateShortId } from '../ids';
import createOrGetConnection from '../db';
import { isValidHttpUrl, standardizeURL } from '../common/links';
import { baseRpcContext } from '../common/connectRpc';
import {
  CreatePostRequest,
  CreatePostResponse,
  PostService,
} from '@dailydotdev/schema';
import { DataSource, FindOptionsWhere } from 'typeorm';
import { logger } from '../logger';

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
      url: existingPost.url,
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

    const con = await createOrGetConnection();

    try {
      req.url = standardizeURL(req.url);

      validateCreatePostRequest(req);

      const postId = await generateShortId();
      const postEntity = con.getRepository(ArticlePost).create({
        ...req,
        id: postId,
        shortId: postId,
        visible: false,
        sentAnalyticsReport: false,
        showOnFeed: false,
      });
      const newPost = await con.getRepository(ArticlePost).insert(postEntity);

      return {
        postId: newPost.identifiers[0].id,
        url: req.url,
      };
    } catch (error) {
      logger.error({ err: error }, 'error while creating post');

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
}
