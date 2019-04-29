import rp from 'request-promise-native';
import config from './config';

export const refreshGoogleToken = async (userId, refreshToken) => {
  const res = await rp({
    url: config.google.authenticateUrl,
    method: 'POST',
    headers: {
      accept: 'application/json',
    },
    form: {
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    },
  });

  return (typeof res === 'string') ? JSON.parse(res) : res;
};

export const fetchGoogleProfile = accessToken =>
  rp.get(`https://people.googleapis.com/v1/people/me?personFields=emailAddresses,names,photos&access_token=${accessToken}`)
    .then(res => JSON.parse(res));

export const callGithubApi = (endpoint, accessToken) =>
  rp.get({
    url: `https://api.github.com/${endpoint}?access_token=${accessToken}`,
    headers: {
      'User-Agent': 'Daily',
    },
  })
    .then(res => JSON.parse(res));

export const fetchGithubProfile = accessToken =>
  callGithubApi('user', accessToken);

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

export const fetchInfo = async (user) => {
  if (user.provider === 'github') {
    const [profile, emails] = await Promise.all([
      fetchGithubProfile(user.accessToken),
      callGithubApi('user/public_emails', user.accessToken),
    ]);
    if (emails.length) {
      return {
        name: profile.name,
        email: emails[0].email,
      };
    }
  }

  const token = await refreshGoogleToken(user.userId, user.refreshToken);
  const profile = await fetchGoogleProfile(token.access_token);
  if (profile.emailAddresses.length) {
    return {
      name: profile.names[0].displayName,
      email: profile.emailAddresses[0].value,
    };
  }

  return null;
};
