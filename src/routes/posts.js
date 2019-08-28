import rp from 'request-promise-native';
import Router from 'koa-router';
import validator, { array, date, number, object, string } from 'koa-context-validator';
import config from '../config';
import post from '../models/post';
import { EntityNotFoundError, ForbiddenError } from '../errors';
import { notifyPostReport } from '../slack';

const router = Router({
  prefix: '/posts',
});

const splitArrayStr = str => (str ? str.split(',') : null);

const getFeedParams = (ctx, rankBy, filters = {}) => {
  const { query } = ctx.request;
  const userId = ctx.state.user ? ctx.state.user.userId : null;
  return {
    fields: userId ? post.defaultUserFields : post.defaultAnonymousFields,
    filters: Object.assign({}, { before: query.latest }, filters),
    rankBy,
    userId,
    page: query.page,
    pageSize: query.pageSize,
  };
};

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

    const feedParams = getFeedParams(ctx, 'popularity');
    if (!ctx.state.user) {
      feedParams.filters = Object.assign({}, feedParams.filters, {
        publications: { include: splitArrayStr(query.pubs) },
        tags: { include: splitArrayStr(query.tags) },
      });
    }
    ctx.body = await post.generateFeed(feedParams);
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
    ctx.body = await post.generateFeed(getFeedParams(ctx, 'creation', { tags: { include: [query.tag] } }));
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
    ctx.body = await post.generateFeed(getFeedParams(ctx, 'creation', { publications: { include: [query.pub] } }));
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
    const after = new Date(query.latest.getTime() - (24 * 60 * 60 * 1000));
    const feedParams = Object.assign({}, getFeedParams(ctx, 'creation', { after }), { pageSize: 8 });
    const [posts, ads] = await Promise.all([
      post.generateFeed(feedParams),
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

    ctx.status = 200;
    ctx.body = await post.generateFeed(
      getFeedParams(ctx, null, { bookmarks: true }),
      query => query.orderByRaw(`${post.bookmarksTable}.created_at DESC`),
    );
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
    const res = await post.generateFeed({
      fields: post.defaultAnonymousFields,
      filters: { postId: ctx.params.id },
      page: 0,
      pageSize: 1,
    });
    const model = res.length ? res[0] : null;
    if (model) {
      ctx.status = 200;
      ctx.body = model;
    } else {
      throw new EntityNotFoundError('post', 'id', ctx.params.id);
    }
  },
);

const reasons = {
  broken: 'Link is broken',
  nsfw: 'Post is NSFW',
};

router.post(
  '/:id/report',
  validator({
    body: object().keys({
      reason: string().required(),
    }),
  }, {
    stripUnknown: true,
  }),
  async (ctx) => {
    const { body } = ctx.request;
    const reason = reasons[body.reason];
    const model = await post.get(ctx.params.id);
    if (model) {
      await Promise.all([
        notifyPostReport(ctx.state.user.userId, model, reason),
        post.hidePost(ctx.state.user.userId, model.id),
      ]);
      ctx.status = 204;
    } else {
      throw new EntityNotFoundError('post', 'id', ctx.params.id);
    }
  },
);

export default router;
