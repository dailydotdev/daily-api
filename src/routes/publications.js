import Router from 'koa-router';
import validator, { object, string } from 'koa-context-validator';
import publication from '../models/publication';
import { notifyNewSource } from '../slack';
import provider from '../models/provider';
import { fetchInfo } from '../profile';

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
    const userProvider = await provider.getByUserId(ctx.state.user.userId);
    const { email, name } = await fetchInfo(userProvider);
    await notifyNewSource(ctx.state.user.userId, name, email, body.source);
    ctx.status = 204;
  },
);

export default router;
