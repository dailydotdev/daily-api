import rp from 'request-promise-native';

const splitArrayStr = str => (str ? str.split(',') : null);

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
    console.warn('failed to fetch ad from monetization service', {
      err,
    });

    return [];
  }
};

export default {
  splitArrayStr,
  fetchToiletAd,
};
