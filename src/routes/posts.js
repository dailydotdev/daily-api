import rp from 'request-promise-native';
import Router from 'koa-router';
import validator, { array, date, number, string } from 'koa-context-validator';
import config from '../config';
import post from '../models/post';
import { EntityNotFoundError, ForbiddenError } from '../errors';

const router = Router({
  prefix: '/posts',
});

const splitArrayStr = str => (str ? str.split(',') : null);

router.get(
  '/latest',
  validator({
    query: {
      latest: date().iso().required(),
      page: number().min(0).required(),
      pageSize: number().positive().required(),
      pubs: string(),
      tags: string(),
    },
  }),
  async (ctx) => {
    const { query } = ctx.request;
    ctx.status = 200;
    if (!ctx.state.user) {
      ctx.body = await post.getLatest(
        query.latest, query.page, query.pageSize,
        splitArrayStr(query.pubs), splitArrayStr(query.tags),
      );
    } else {
      ctx.body =
        await post.getUserLatest(query.latest, query.page, query.pageSize, ctx.state.user.userId);
    }
  },
);

router.get(
  '/tag',
  validator({
    query: {
      latest: date().iso().required(),
      page: number().min(0).required(),
      pageSize: number().positive().required(),
      tag: string().required(),
    },
  }),
  async (ctx) => {
    const { query } = ctx.request;
    ctx.status = 200;
    ctx.body = await post.getByTag(
      query.latest, query.page, query.pageSize, query.tag,
      ctx.state.user ? ctx.state.user.userId : null,
    );
  },
);

router.get(
  '/publication',
  validator({
    query: {
      latest: date().iso().required(),
      page: number().min(0).required(),
      pageSize: number().positive().required(),
      pub: string().required(),
    },
  }),
  async (ctx) => {
    const { query } = ctx.request;
    ctx.status = 200;
    ctx.body = await post.getByPublication(
      query.latest, query.page, query.pageSize, query.pub,
      ctx.state.user ? ctx.state.user.userId : null,
    );
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

const fetchToiletAd = async (ctx) => {
  try {
    const { ip } = ctx.request;
    const res = await rp({
      url: `${config.monetizationUrl}/a/toilet`,
      method: 'GET',
      headers: {
        'x-forwarded-for': ip,
      },
    });
    return JSON.parse(res);
  } catch (err) {
    ctx.log.warn('failed to fetch ad from monetization service', { err });
    return [];
  }
};

router.get(
  '/toilet',
  validator({
    query: {
      latest: date().iso().required(),
      page: number().min(0).required(),
    },
  }),
  async (ctx) => {
    if (!ctx.state.user) {
      throw new ForbiddenError();
    }

    const { query } = ctx.request;

    const assignType = type => x => Object.assign({}, x, { type });

    const [posts, ads] = await Promise.all([
      post.getToilet(query.latest, query.page, 8, ctx.state.user.userId),
      query.page === 0 ? Promise.resolve([]) : fetchToiletAd(ctx),
    ]);

    ctx.status = 200;
    ctx.body = [].concat(ads.map(assignType('ad')), posts.map(assignType('post')));
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
