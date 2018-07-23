import Router from 'koa-router';
import rp from 'request-promise-native';
import { ForbiddenError } from '../errors';
import { initSession } from '../sessions';
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
    initSession(ctx);
    if (ctx.session.userId) {
      const body = {
        id: ctx.session.userId,
        loggedIn: ctx.session.loggedIn,
        providers: ctx.session.providers,
      };

      if (ctx.session.loggedIn) {
        const userProvider = await provider.getByUserId(ctx.session.userId);
        if (!userProvider) {
          ctx.session = null;
          throw new ForbiddenError();
        }

        if (userProvider.expiresIn && userProvider.expiresIn < new Date()) {
          ctx.log.info(`refreshing access token for user ${ctx.session.userId}`);
          const res = await refreshGoogleToken(ctx.session.userId, userProvider.refreshToken);
          await provider.updateToken(
            ctx.session.userId, userProvider.provider,
            res.access_token, new Date(Date.now() + (res.expires_in * 1000)),
          );
          userProvider.accessToken = res.access_token;
        }

        const profile = await fetchProfile(userProvider.provider, userProvider.accessToken);
        ctx.status = 200;

        if (userProvider.provider === 'github') {
          ctx.body = Object.assign({}, body, {
            name: profile.name,
            profile: profile.avatar_url,
          });
        } else {
          ctx.body = Object.assign({}, body, {
            name: profile.displayName,
            profile: profile.image.url.split('?')[0],
          });
        }
      } else {
        ctx.status = 200;
        ctx.body = body;
      }
    } else {
      throw new ForbiddenError();
    }
  },
);

export default router;
