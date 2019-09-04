import rp from 'request-promise-native';

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

const assignType = type => x => Object.assign({}, x, { type });

const fetchToiletAd = async (ip, config) => {
  try {
    const res = await rp({
      url: `${config.monetizationUrl}/a/toilet`,
      method: 'GET',
      headers: {
        'x-forwarded-for': ip,
      },
    });

    return JSON.parse(res);
  } catch (err) {
    // eslint-disable-next-line
    console.warn('failed to fetch ad from monetization service', { err });

    return [];
  }
};

export default {
  getFeedParams,
  splitArrayStr,
  assignType,
  fetchToiletAd,
};
