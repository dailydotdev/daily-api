import Router from 'koa-router';
import validator, { date } from 'koa-context-validator';
import notification from '../models/notification';
import cors from '../middlewares/cors';

const router = Router({
  prefix: '/notifications',
});

router.get(
  '/',
  cors,
  validator({
    query: {
      since: date().iso().default(null),
    },
  }),
  async (ctx) => {
    const latestPromise = notification.getLatest();
    const since = await notification.get(ctx.request.query.since);

    ctx.status = 200;
    if (since.length) {
      ctx.body = since;
    } else {
      const latest = await latestPromise;
      ctx.body = latest ? [latest] : [];
    }
  },
);

export default router;
