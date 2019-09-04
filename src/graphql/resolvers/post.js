/* eslint-disable */

import helpers from '../helpers/post';
import { EntityNotFoundError, ForbiddenError } from '../../errors';

export default {
  Query: {
    async latest(parent, { params: args = {} }, { models: { post }, user }, info) {
      args.latest = args.latest ? new Date(args.latest) : null;

      const feedParams = helpers.getFeedParams({ post, user }, args, 'popularity');

      if (!user) {
        feedParams.filters = Object.assign({}, feedParams.filters, {
          publications: { include: helpers.splitArrayStr(args.pubs) },
          tags: { include: helpers.splitArrayStr(args.tags) },
        });
      }

      return await post.generateFeed(feedParams);
    },

    async post(parent, args, { models, user }) {
      const result = await models.post.generateFeed({
        fields: models.post.defaultAnonymousFields,
        filters: { postId: args.id },
        page: 0,
        pageSize: 1,
      });

      if (result.length) {
        return result[0];
      }

      throw new EntityNotFoundError('post', 'id', args.id);
    },

    async bookmarks(parent, { params: args }, { user, models: { post } }) {
      if (!user) {
        throw new ForbiddenError();
      }


      args.latest = args.latest ? new Date(args.latest) : null;


      return await post.generateFeed(
        helpers.getFeedParams({ post, user }, args, null, { bookmarks: true }),
        query => query.orderByRaw(`${post.bookmarksTable}.created_at DESC`),
      );
    },

    async toilet(parent, { params }, { user, models: { post }, config, meta }, info) {
      if (!user) {
        throw new ForbiddenError();
      }

      params.latest = new Date(params.latest);

      const after = new Date(params.latest.getTime() - (24 * 60 * 60 * 1000));
      const feedParams = Object.assign(
        {},
        helpers.getFeedParams({ post, user }, params, 'creation', { after }),
        { pageSize: 8 }
      );
      const [posts, ads] = await Promise.all([
        post.generateFeed(feedParams),
        params.page === 0 ? Promise.resolve([]) : helpers.fetchToiletAd(meta.ip, config),
      ]);

      return [...ads.map(helpers.assignType('ad')), ...posts.map(helpers.assignType('post'))];
    }
  },

  Mutation: {
    async SetBookmarks(parent, { ids: postIds }, { user, models: { post } }, info) {
      if (!user) {
        throw new ForbiddenError();
      }

      const bookmarks = postIds.map(postId => ({
        userId: user.userId,
        postId,
      }));

      await post.bookmark(bookmarks);

      return postIds;
    },

    async RemoveBookmark(parent, { id }, { user, models: { post } }, info) {
      if (!user) {
        throw new ForbiddenError();
      }

      await post.removeBookmark(user.userId, id);

      return id;
    }
  },

  Post: {
    created_at(parent) {
      return parent.createdAt && parent.createdAt.toISOString();
    },

    read_time(parent) {
      return parent.readTime;
    },

    published_at(parent) {
      return parent.publishedAt && parent.publishedAt.toISOString();
    },
  },
};
