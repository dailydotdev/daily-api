import cors from '@koa/cors';
import config from '../config';

const corsMiddleware = cors({
  credentials: true,
  origin(ctx) {
    const requestOrigin = ctx.get('Origin');
    if (config.cors.origin.indexOf(requestOrigin) > -1) {
      return requestOrigin;
    }
    return false;
  },
});

export default (ctx, next) => {
  if (config.env === 'test') {
    return next();
  }

  const requestOrigin = ctx.get('Origin');

  if (!requestOrigin) {
    ctx.status = 401;
    return Promise.resolve();
  }

  return corsMiddleware(ctx, next);
};
