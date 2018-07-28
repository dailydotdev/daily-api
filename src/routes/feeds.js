import Router from 'koa-router';
import validator, { object, string, boolean, array } from 'koa-context-validator';
import feed from '../models/feed';
import { ForbiddenError } from '../errors';

const router = Router({
  prefix: '/feeds',
});

router.get(
  '/publications',
  async (ctx) => {
    if (!ctx.state.user) {
      throw new ForbiddenError();
    }

    const model = await feed.getByUserId(ctx.state.user.userId);

    ctx.status = 200;
    ctx.body = model;
  },
);

router.post(
  '/publications',
  validator({
    body: array().items(object().keys({
      publicationId: string().required(),
      enabled: boolean().required(),
    })),
  }, {
    stripUnknown: true,
  }),
  async (ctx) => {
    if (!ctx.state.user) {
      throw new ForbiddenError();
    }

    const model = await feed.upsert(ctx.request.body.map(item =>
      Object.assign({ userId: ctx.state.user.userId }, item)));

    ctx.status = 200;
    ctx.body = model;
  },
);

export default router;
