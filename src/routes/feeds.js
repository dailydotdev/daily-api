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

    const model = await feed.getUserPublications(ctx.state.user.userId);

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

    const model = await feed.upsertUserPublications(ctx.request.body.map(item =>
      Object.assign({ userId: ctx.state.user.userId }, item)));

    ctx.status = 200;
    ctx.body = model;
  },
);

router.get(
  '/tags',
  async (ctx) => {
    if (!ctx.state.user) {
      throw new ForbiddenError();
    }

    const model = await feed.getUserTags(ctx.state.user.userId);

    ctx.status = 200;
    ctx.body = model;
  },
);

router.post(
  '/tags',
  validator({
    body: array().items(object().keys({
      tag: string().required(),
    })),
  }, {
    stripUnknown: true,
  }),
  async (ctx) => {
    if (!ctx.state.user) {
      throw new ForbiddenError();
    }

    const model = await feed.addUserTags(ctx.request.body.map(item =>
      Object.assign({ userId: ctx.state.user.userId }, item)));

    ctx.status = 200;
    ctx.body = model;
  },
);

router.delete(
  '/tags',
  validator({
    body: object().keys({
      tag: string().required(),
    }),
  }, {
    stripUnknown: true,
  }),
  async (ctx) => {
    if (!ctx.state.user) {
      throw new ForbiddenError();
    }

    await feed.removeUserTags(ctx.request.body.tag, ctx.state.user.userId);

    ctx.status = 204;
  },
);

export default router;
