import Router from 'koa-router';
import rp from 'request-promise-native';
import { ForbiddenError } from '../errors';
import config from '../config';
import provider from '../models/provider';
import { fetchProfile } from '../profile';

const refreshGoogleToken = async (userId, refreshToken) => {
  const res = await rp({
    url: config.google.authenticateUrl,
    method: 'POST',
    headers: {
      accept: 'application/json',
    },
    form: {
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    },
  });

  return (typeof res === 'string') ? JSON.parse(res) : res;
};

const router = Router({
  prefix: '/users',
});

router.get(
  '/me',
  async (ctx) => {
    if (ctx.state.user) {
      const { userId } = ctx.state.user;
      const userProvider = await provider.getByUserId(userId);
      if (!userProvider) {
        ctx.session = null;
        throw new ForbiddenError();
      }

      if (userProvider.expiresIn && userProvider.expiresIn < new Date()) {
        ctx.log.info(`refreshing access token for user ${userId}`);
        const res = await refreshGoogleToken(userId, userProvider.refreshToken);
        await provider.updateToken(
          userId, userProvider.provider,
          res.access_token, new Date(Date.now() + (res.expires_in * 1000)),
        );
        userProvider.accessToken = res.access_token;
      }

      const profile = await fetchProfile(userProvider.provider, userProvider.accessToken);
      ctx.status = 200;
      ctx.body = {
        id: userId,
        providers: [userProvider.provider],
        name: profile.name,
        image: profile.image,
      };
    } else if (ctx.session.userId) {
      ctx.status = 200;
      ctx.body = { id: ctx.session.userId };
    } else {
      throw new ForbiddenError();
    }
  },
);

router.post(
  '/logout',
  async (ctx) => {
    ctx.session = null;
    ctx.status = 204;
  },
);

export default router;
