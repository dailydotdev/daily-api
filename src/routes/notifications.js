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
    const model = await notification.get(ctx.request.query.since);

    ctx.status = 200;
    ctx.body = model;
  },
);

export default router;
