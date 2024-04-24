import { Code, ConnectError, ConnectRouter } from '@connectrpc/connect';
import { TypeOrmError } from '../errors';
import { ArticlePost } from '../entity';
import { generateShortId } from '../ids';
import createOrGetConnection from '../db';
import { standardizeURL } from '../common/links';
import { baseRpcContext } from '../common/connectRpc';
import { PostService } from '@dailydotdev/schema';

export default function (router: ConnectRouter) {
  router.rpc(PostService, PostService.methods.create, async (req, context) => {
    if (!context.values.get(baseRpcContext).service) {
      throw new ConnectError('not found', Code.NotFound);
    }

    const con = await createOrGetConnection();

    try {
      req.url = standardizeURL(req.url);

      const postId = await generateShortId();
      const postEntity = con.getRepository(ArticlePost).create({
        ...req,
        id: postId,
        shortId: postId,
      });
      const newPost = await con.getRepository(ArticlePost).insert(postEntity);

      return {
        postId: newPost.identifiers[0].id,
        url: req.url,
      };
    } catch (error) {
      if (error?.code === TypeOrmError.DUPLICATE_ENTRY) {
        throw new ConnectError('conflict', Code.AlreadyExists);
      }

      throw new ConnectError(error.message, Code.Internal);
    }
  });
}
