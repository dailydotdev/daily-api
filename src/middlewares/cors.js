import config from '../config';

export default (ctx, next) => {
  if (config.env === 'test') {
    return next();
  }

  const requestOrigin = ctx.get('Origin');

  if (!requestOrigin) {
    ctx.status = 401;
    return Promise.resolve();
  }

  return next();
};
