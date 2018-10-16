import uuid4 from 'uuid/v4';
import config from './config';

export const setTrackingId = (ctx, id) => {
  ctx.trackingId = id;
  if (id) {
    ctx.cookies.set(config.cookies.key, id, config.cookies.opts);
  } else {
    ctx.cookies.set(config.cookies.key);
  }
};

export const getTrackingId = (ctx) => {
  if (!ctx.trackingId || !ctx.trackingId.length) {
    ctx.trackingId = ctx.cookies.get(config.cookies.key, config.cookies.opts);
  }

  return ctx.trackingId;
};

export default function (ctx, next) {
  if (!ctx.userAgent.isBot) {
    let userId = getTrackingId(ctx);
    if (ctx.state.user) {
      // eslint-disable-next-line
      userId = ctx.state.user.userId;
    } else if (!userId || !userId.length) {
      userId = uuid4().replace(/-/g, '');
    }

    if (userId !== getTrackingId(ctx)) {
      setTrackingId(ctx, userId);
    }
    ctx.request.headers['User-Id'] = userId;
  }
  return next();
}
