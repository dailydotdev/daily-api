import uuid4 from 'uuid/v4';

export default function (ctx, next) {
  if (!ctx.userAgent.isBot) {
    if (ctx.state.user) {
      ctx.session.userId = ctx.state.userId;
    } else if (ctx.session.isNew || !ctx.session.userId) {
      ctx.session.userId = uuid4().replace(/-/g, '');
    }
    ctx.request.headers['User-Id'] = ctx.session.userId;
  }
  return next();
}
