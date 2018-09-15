import Router from 'koa-router';
import validator, { array, date, number, string } from 'koa-context-validator';
import post from '../models/post';
import { EntityNotFoundError, ForbiddenError } from '../errors';

const router = Router({
  prefix: '/posts',
});

router.get(
  '/latest',
  validator({
    query: {
      latest: date().iso().required(),
      page: number().min(0).required(),
      pageSize: number().positive().max(40).required(),
      pubs: string(),
    },
  }),
  async (ctx) => {
    const { query } = ctx.request;
    ctx.status = 200;
    if (!ctx.state.user) {
      ctx.body = await post.getLatest(query.latest, query.page, query.pageSize, query.pubs ? query.pubs.split(',') : null);
    } else {
      ctx.body =
        await post.getUserLatest(query.latest, query.page, query.pageSize, ctx.state.user.userId);
    }
  },
);

router.get(
  '/promoted',
  async (ctx) => {
    ctx.status = 200;
    ctx.body = await post.getPromoted();
  },
);

router.get(
  '/views',
  async (ctx) => {
    ctx.log.info('updating views');
    await post.updateViews();
    ctx.status = 204;
  },
);

router.get(
  '/bookmarks',
  validator({
    query: {
      latest: date().iso().required(),
      page: number().min(0).required(),
      pageSize: number().positive().max(40).required(),
    },
  }),
  async (ctx) => {
    if (!ctx.state.user) {
      throw new ForbiddenError();
    }

    const model = await post.getBookmarks(
      ctx.query.latest,
      ctx.query.page,
      ctx.query.pageSize,
      ctx.state.user.userId,
    );

    ctx.status = 200;
    ctx.body = model;
  },
);

router.post(
  '/bookmarks',
  validator({
    body: array().items(string()),
  }),
  async (ctx) => {
    if (!ctx.state.user) {
      throw new ForbiddenError();
    }

    const bookmarks = ctx.request.body.map(postId => ({ userId: ctx.state.user.userId, postId }));
    await post.bookmark(bookmarks);

    ctx.status = 200;
    ctx.body = ctx.request.body;
  },
);

router.delete(
  '/:id/bookmark',
  async (ctx) => {
    if (!ctx.state.user) {
      throw new ForbiddenError();
    }

    await post.removeBookmark(ctx.state.user.userId, ctx.params.id);

    ctx.status = 204;
  },
);

router.get(
  '/:id',
  async (ctx) => {
    const model = await post.get(ctx.params.id);
    if (model) {
      ctx.status = 200;
      ctx.body = model;
    } else {
      throw new EntityNotFoundError('post', 'id', ctx.params.id);
    }
  },
);

export default router;
