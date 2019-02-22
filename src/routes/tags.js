import Router from 'koa-router';
import validator, { string } from 'koa-context-validator';
import tag from '../models/tag';

const router = Router({
  prefix: '/tags',
});

router.get(
  '/popular',
  async (ctx) => {
    ctx.status = 200;
    ctx.body = await tag.getPopular();
  },
);

router.get(
  '/search',
  validator({
    query: {
      query: string().required(),
    },
  }),
  async (ctx) => {
    const { query } = ctx.request.query;
    const hits = await tag.search(query);
    ctx.status = 200;
    ctx.body = {
      query,
      hits,
    };
  },
);

router.post(
  '/updateCount',
  async (ctx) => {
    ctx.log.info('updating tags count');
    await tag.updateTagsCount();
    ctx.status = 204;
  },
);

export default router;
