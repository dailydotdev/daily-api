import Router from 'koa-router';
import validator, { date, number, string } from 'koa-context-validator';
import post from '../models/post';
import { EntityNotFoundError, ValidationError, EntityExistError } from '../errors';
import validations from '../validations';
import adminAuth from '../middlewares/adminAuth';

const router = Router({
  prefix: '/posts',
});

router.get(
  '/latest',
  validator({
    query: {
      latest: date().iso().required(),
      page: number().min(0).required(),
      pageSize: number().positive().max(40).required(),
      pubs: string(),
    },
  }),
  async (ctx) => {
    const { query } = ctx.request;
    ctx.status = 200;
    ctx.body = await post.getLatest(query.latest, query.page, query.pageSize, query.pubs ? query.pubs.split(',') : null);
  },
);

router.get(
  '/promoted',
  async (ctx) => {
    ctx.status = 200;
    ctx.body = await post.getPromoted();
  },
);

router.get(
  '/views',
  async (ctx) => {
    ctx.log.info('updating views');
    await post.updateViews();
    ctx.status = 204;
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
