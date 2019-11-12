/* eslint-disable */

import helpers from '../helpers/post';
import utils from '../../utils';
import { EntityNotFoundError, ForbiddenError } from '../../errors';

export default {
  Query: {
    latest(parent, { params: args = {} }, { models: { post }, user }, info) {
      args.latest = args.latest ? new Date(args.latest) : null;

      const feedParams = helpers.getFeedParams({ post, user }, args, 'popularity');

      if (!user) {
        feedParams.filters = Object.assign({}, feedParams.filters, {
          publications: { include: utils.splitArrayStr(args.pubs) },
          tags: { include: utils.splitArrayStr(args.tags) },
        });
      }

      return post.generateFeed(feedParams);
    },

    async post(parent, args, { models: { post }, user }) {
      const result = await post.generateFeed({
        fields: post.defaultAnonymousFields,
        filters: { postId: args.id },
        page: 0,
        pageSize: 1,
      });

      if (result.length) {
        return result[0];
      }

      throw new EntityNotFoundError('post', 'id', args.id);
    },

    bookmarks(parent, { params: args }, { user, models: { post } }) {
      if (!user) {
        throw new ForbiddenError();
      }

      args.latest = args.latest ? new Date(args.latest) : null;

      return post.generateFeed(
        helpers.getFeedParams({ post, user }, args, null, { bookmarks: true }, true),
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
        { pageSize: 8 },
      );
      const [posts, ads] = await Promise.all([
        post.generateFeed(feedParams),
        params.page === 0 ? Promise.resolve([]) : utils.fetchToiletAd(meta.ip, config),
      ]);

      return [...ads.map(helpers.assignType('ad')), ...posts.map(helpers.assignType('post'))];
    },

    postsByPublication(parent, { params }, { models: { post } }, info) {
      params.latest = new Date(params.latest);

      return post.generateFeed(
        helpers.getFeedParams(
          { post },
          params,
          'creation',
          { publications: { include: [params.pub] } },
          true,
        ),
      );
    },

    postsByTag(parent, { params }, { models: { post } }, info) {
      params.latest = new Date(params.latest);

      return post.generateFeed(
        helpers.getFeedParams(
          { post },
          params,
          'creation',
          { tags: { include: [params.tag] } },
          true,
        ),
      );
    },

    search(parent, { params }, { user, models: { post }, meta }, info) {
      params.latest = new Date(params.latest);

      return post.generateFeed(
        helpers.getFeedParams(
          { post, user },
          params,
          'creation',
          { search: params.query },
          true,
          meta.ip,
        ),
      );
    },

    async searchSuggestion(parent, { params }, { user, models: { post }, meta }, info) {
      const suggestions = await post.searchPosts(params.query, { hitsPerPage: 5 }, user && user.userId, meta.ip);
      return suggestions.map(s => ({
        title: s.title,
      }));
    },
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
    },

    async HidePost(parent, { id }, { models: { post }, user }, info) {
      const model = await post.get(id);

      if (!model) {
        throw new EntityNotFoundError('post', 'id', id);
      }

      await post.hide(user.userId, model.id);

      return id;
    },
  },

  Post: {
    createdAt(parent) {
      return parent.createdAt && parent.createdAt.toISOString();
    },

    publishedAt(parent) {
      return parent.publishedAt && parent.publishedAt.toISOString();
    },
  },
};
