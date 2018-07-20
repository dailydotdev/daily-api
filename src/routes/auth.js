import Router from 'koa-router';
import rp from 'request-promise-native';
import uuid4 from 'uuid/v4';
import validator, { object, string } from 'koa-context-validator';
import { initSession } from '../sessions';
import config from '../config';
import provider from '../models/provider';

const router = Router({
  prefix: '/auth',
});

router.get(
  '/github/authorize',
  validator({
    query: {
      redirect_uri: string().required(),
    },
  }),
  async (ctx) => {
    const { query } = ctx.request;
    const state = uuid4().replace(/-/g, '');
    const redirectUri = encodeURIComponent(`${config.urlPrefix}/v1/auth/github/callback?redirect_uri=${query.redirect_uri}`);
    const url = `https://github.com/login/oauth/authorize?redirect_uri=${redirectUri}&client_id=${config.github.clientId}&scope=user:email&state=${state}`;

    ctx.status = 301;
    ctx.redirect(url);
  },
);

router.get('/github/callback', async (ctx) => {
  const { query } = ctx.request;
  ctx.status = 301;
  ctx.redirect(`${query.redirect_uri}?code=${query.code}&state=${query.state}`);
});

router.post(
  '/github/authenticate',
  validator({
    body: object().keys({
      state: string().required(),
      code: string().required(),
    }),
  }),
  async (ctx) => {
    const { body } = ctx.request;
    const res = await rp({
      url: 'https://github.com/login/oauth/access_token',
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      json: {
        client_id: config.github.clientId,
        client_secret: config.github.clientSecret,
        state: body.state,
        code: body.code,
      },
    });

    if (!res.access_token) {
      ctx.status = 403;
      return;
    }

    initSession(ctx);
    ctx.session.loggedIn = true;
    ctx.session.providers = ctx.session.providers || [];
    if (ctx.session.providers.indexOf('github') < 0) {
      ctx.session.providers.push('github');
    }
    ctx.log.info(`connected ${ctx.session.userId} with github`);

    let newUser = true;
    try {
      await provider.add(ctx.session.userId, 'github', res.access_token);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        newUser = false;
      } else {
        throw err;
      }
    }

    ctx.status = 200;
    ctx.body = {
      id: ctx.session.userId,
      loggedIn: ctx.session.loggedIn,
      providers: ctx.session.providers,
      newUser,
    };
  },
);

export default router;
