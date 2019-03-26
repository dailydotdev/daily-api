import Router from 'koa-router';
import validator, { object, string } from 'koa-context-validator';
import publication from '../models/publication';
import { notifyNewSource } from '../slack';

const router = Router({
  prefix: '/publications',
});

router.get(
  '/',
  async (ctx) => {
    const models = await publication.getEnabled();

    ctx.status = 200;
    ctx.body = models;
  },
);

router.post(
  '/request',
  validator({
    body: object().keys({
      source: string().uri().required(),
    }),
  }, {
    stripUnknown: true,
  }),
  async (ctx) => {
    const { body } = ctx.request;
    await notifyNewSource(ctx.state.user.userId, body.source);
    ctx.status = 204;
  },
);

export default router;
