import Router from 'koa-router';
import validator, { object, string } from 'koa-context-validator';
import publication from '../models/publication';
import { notifyNewSource } from '../slack';
import { fetchInfo } from '../profile';
import { ForbiddenError } from '../errors';

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
    if (!ctx.state.user || !ctx.state.user.userId) {
      throw new ForbiddenError();
    }

    const { body } = ctx.request;
    const { email, name } = await fetchInfo(ctx.state.user.userId);
    await notifyNewSource(ctx.state.user.userId, name, email, body.source);
    ctx.status = 204;
  },
);

export default router;
