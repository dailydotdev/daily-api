import Router from 'koa-router';
import validator, { object, string, boolean } from 'koa-context-validator';
import settings from '../models/settings';
import { ForbiddenError } from '../errors';

const router = Router({
  prefix: '/settings',
});

router.get(
  '/',
  async (ctx) => {
    if (!ctx.state.user) {
      throw new ForbiddenError();
    }

    const model = await settings.getByUserId(ctx.state.user.userId);

    ctx.status = 200;
    ctx.body = model;
  },
);

router.post(
  '/',
  validator({
    body: object().keys({
      theme: string(),
      showTopSites: boolean(),
      enableCardAnimations: boolean(),
      insaneMode: boolean(),
      appInsaneMode: boolean(),
    }),
  }, {
    stripUnknown: true,
  }),
  async (ctx) => {
    if (!ctx.state.user) {
      throw new ForbiddenError();
    }

    const model = await settings.upsert(Object.assign({
      userId: ctx.state.user.userId,
    }, ctx.request.body));

    ctx.status = 200;
    ctx.body = model;
  },
);

export default router;
