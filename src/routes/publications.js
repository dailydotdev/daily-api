import Router from 'koa-router';
import publication from '../models/publication';
import cors from '../middlewares/cors';

const router = Router({
  prefix: '/publications',
});

router.get(
  '/',
  cors,
  async (ctx) => {
    const models = await publication.getEnabled();

    ctx.status = 200;
    ctx.body = models;
  },
);

export default router;
