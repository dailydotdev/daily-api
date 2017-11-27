import Router from 'koa-router';
import post from '../models/post';
import { EntityNotFoundError } from '../errors';
import { initSession } from '../sessions';
import { add as addEvent } from '../events';

const updateQueryParameter = (url, key, value) => {
  const re = new RegExp(`([?&])${key}=.*?(&|$)`, 'i');
  const separator = url.indexOf('?') !== -1 ? '&' : '?';
  if (url.match(re)) {
    return url.replace(re, `$1${key}=${value}$2`);
  }

  return `${url}${separator}${key}=${value}`;
};

const router = Router({
  prefix: '/r',
});

router.get(
  '/:id',
  async (ctx) => {
    const model = await post.get(ctx.params.id, 'url');
    if (model) {
      initSession(ctx);
      if (ctx.session.userId) {
        ctx.log.info(`redirecting user ${ctx.session.userId} to post ${model.id}`);
        addEvent(ctx, 'view', model.id);
      } else {
        ctx.log.info(`redirecting bot to post ${model.id}`);
      }

      ctx.status = 301;
      ctx.redirect(updateQueryParameter(model.url, 'ref', 'daily'));
    } else {
      throw new EntityNotFoundError('post', 'id', ctx.params.id);
    }
  },
);

export default router;
