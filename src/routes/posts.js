import Router from 'koa-router';
import validator, { date, number } from 'koa-context-validator';
import post from '../models/post';
import { EntityNotFoundError } from '../errors';

const router = Router({
  prefix: '/posts',
});

router.get(
  '/latest',
  validator({
    query: {
      latest: date().iso().required(),
      page: number().min(0),
      pageSize: number().positive().max(40),
    },
  }),
  async (ctx) => {
    const { query } = ctx.request;
    ctx.status = 200;
    ctx.body = await post.getLatest(query.latest, query.page, query.pageSize);
  },
);

router.get(
  '/:id',
  async (ctx) => {
    const model = await post.get(ctx.params.id);
    if (model) {
      ctx.status = 200;
      ctx.body = model;
    } else {
      throw new EntityNotFoundError('post', 'id', ctx.params.id);
    }
  },
);

export default router;
