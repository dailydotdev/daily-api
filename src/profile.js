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
export const fetchProfile = async (provider, accessToken) => {
  if (provider === 'github') {
    const profile = await fetchGithubProfile(accessToken);
    return {
      id: profile.id,
      name: profile.name,
      image: profile.avatar_url,
    };
  } else if (provider === 'google') {
    const profile = await fetchGoogleProfile(accessToken);
    return {
      id: profile.id,
      name: profile.displayName,
      image: profile.image.url.split('?')[0],
    };
  }

  throw new Error('unsupported profile provider');
};

