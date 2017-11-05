import Router from 'koa-router';
import validator, { string } from 'koa-context-validator';
import post from '../models/post';
import { EntityNotFoundError } from '../errors';

const router = Router({
  prefix: '/r',
});

router.get(
  '/',
  validator({
    query: {
      link: string().required(),
      post: string().required(),
      source: string().required(),
    },
  }),
  async (ctx) => {
    const { query } = ctx.request;
    ctx.status = 301;
    ctx.redirect(query.link);
  },
);

router.get(
  '/:id',
  async (ctx) => {
    const model = await post.get(ctx.params.id, 'url');
    if (model) {
      ctx.status = 301;
      ctx.redirect(model.url);
    } else {
      throw new EntityNotFoundError('post', 'id', ctx.params.id);
    }
  },
);

export default router;
