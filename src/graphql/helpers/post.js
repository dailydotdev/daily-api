const getFeedParams = ({ user, post }, args, rankBy, filters = {}) => {
  const userId = user ? user.userId : null;

  return {
    fields: userId ? post.defaultUserFields : post.defaultAnonymousFields,
    filters: Object.assign({}, { before: args.latest }, filters),
    rankBy,
    userId,
    page: args.page,
    pageSize: args.pageSize,
  };
};

const assignType = type => x => Object.assign({}, x, { type });

export default {
  getFeedParams,
  assignType,
};
