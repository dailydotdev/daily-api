const getFeedParams =
  ({ user, post }, args, rankBy, filters = {}, ignoreUserFilters = false, ip) => {
    const userId = user ? user.userId : null;

    return {
      fields: userId ? [...post.defaultUserFields, 'read'] : post.defaultAnonymousFields,
      filters: Object.assign({}, { before: args.latest }, filters, typeof args.read === 'boolean' && userId && { read: args.read }),
      rankBy,
      userId,
      ignoreUserFilters,
      page: args.page,
      pageSize: args.pageSize,
      ip,
    };
  };

const assignType = type => x => Object.assign({}, x, { type });

export default {
  getFeedParams,
  assignType,
};
