
import helpers from '../helpers/post';

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
  },
};
