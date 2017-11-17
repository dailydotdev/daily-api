import event from './models/event';

// eslint-disable-next-line import/prefer-default-export
export const add = async (ctx, type, postId) => {
  try {
    await event.add(
      type, ctx.session.userId, postId, ctx.headers.referer,
      ctx.userAgent.source, ctx.request.ip,
    );
    ctx.log.info(`${type} event added`);
  } catch (err) {
    ctx.log.warn(`failed to add event\n${err}`);
  }
};
