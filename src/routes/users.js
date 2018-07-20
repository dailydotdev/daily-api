import Router from 'koa-router';
import { ForbiddenError } from '../errors';
import { initSession } from '../sessions';

const router = Router({
  prefix: '/users',
});

router.get(
  '/me',
  async (ctx) => {
    initSession(ctx);
    if (ctx.session.userId) {
      ctx.status = 200;
      ctx.body = {
        id: ctx.session.userId,
        loggedIn: ctx.session.loggedIn,
        providers: ctx.session.providers,
      };
    } else {
      throw new ForbiddenError();
    }
  },
);

export default router;
