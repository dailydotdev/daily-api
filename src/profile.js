import rp from 'request-promise-native';

const fetchGoogleProfile = accessToken =>
  rp.get(`https://people.googleapis.com/v1/people/me?personFields=emailAddresses,names,photos&access_token=${accessToken}`)
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
      id: profile.resourceName.replace('people/', ''),
      name: profile.names.length ? profile.names[0].displayName : null,
      image: profile.photos.length ? profile.photos[0].url : null,
    };
  }

  throw new Error('unsupported profile provider');
};

