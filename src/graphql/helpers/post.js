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

const splitArrayStr = str => (str ? str.split(',') : null);

export default {
  getFeedParams,
  splitArrayStr,
};
