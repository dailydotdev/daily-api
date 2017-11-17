import uuid4 from 'uuid/v4';

// eslint-disable-next-line import/prefer-default-export
export const initSession = (ctx) => {
  if (!ctx.userAgent.isBot) {
    if (ctx.session.isNew || !ctx.session.userId) {
      ctx.session.userId = uuid4().replace(/-/g, '');
    }
  }
};
