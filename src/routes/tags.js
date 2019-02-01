import Router from 'koa-router';
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

router.post(
  '/updateCount',
  async (ctx) => {
    ctx.log.info('updating tags count');
    await tag.updateTagsCount();
    ctx.status = 204;
  },
);

export default router;
