import Router from 'koa-router';
import { ForbiddenError } from '../errors';
import provider from '../models/provider';
import { fetchProfile, refreshGoogleToken } from '../profile';
import { getTrackingId, setTrackingId } from '../tracking';

const router = Router({
  prefix: '/users',
});

router.get(
  '/me',
  async (ctx) => {
    const trackingId = getTrackingId(ctx);
    if (ctx.state.user) {
      const { userId } = ctx.state.user;
      const userProvider = await provider.getByUserId(userId);
      if (!userProvider) {
        setTrackingId(ctx, null);
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
    } else if (trackingId && trackingId.length) {
      ctx.status = 200;
      ctx.body = { id: trackingId };
    } else {
      throw new ForbiddenError();
    }
  },
);

router.post(
  '/logout',
  async (ctx) => {
    setTrackingId(ctx, null);
    ctx.status = 204;
  },
);

export default router;
