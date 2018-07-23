import rp from 'request-promise-native';

const fetchGoogleProfile = accessToken =>
  rp.get(`https://www.googleapis.com/plus/v1/people/me?access_token=${accessToken}`)
    .then(res => JSON.parse(res));

const fetchGithubProfile = accessToken =>
  rp.get({
    url: `https://api.github.com/user?access_token=${accessToken}`,
    headers: {
      'User-Agent': 'Daily',
    },
  })
    .then(res => JSON.parse(res));

// eslint-disable-next-line import/prefer-default-export
export const fetchProfile = (provider, accessToken) => {
  if (provider === 'github') {
    return fetchGithubProfile(accessToken);
  } else if (provider === 'google') {
    return fetchGoogleProfile(accessToken);
  }

  throw new Error('unsupported profile provider');
};

