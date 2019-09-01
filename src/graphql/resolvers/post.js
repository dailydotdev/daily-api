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
