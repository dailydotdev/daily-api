import fs from 'fs';
import db, { toCamelCase } from '../db';
import { fetchGithubProfile, callGithubApi, fetchGoogleProfile, refreshGoogleToken } from '../profile';

const fetchGithub = async (accessToken) => {
  const profile = await fetchGithubProfile(accessToken);
  const emails = await callGithubApi('user/public_emails', accessToken);
  if (emails.length) {
    return [{
      name: profile.name,
      email: emails[0].email,
    }];
  }

  return [];
};

const fetchGoogle = async (userId, refreshToken) => {
  const token = await refreshGoogleToken(userId, refreshToken);
  const profile = await fetchGoogleProfile(token.access_token);
  if (profile.emailAddresses.length) {
    return [{
      name: profile.names[0].displayName,
      email: profile.emailAddresses[0].value,
    }];
  }

  return [];
};

const fetchInfo = async (user) => {
  if (user.provider === 'google') {
    return fetchGoogle(user.userId, user.refreshToken);
  }
  return fetchGithub(user.accessToken);
};

const fetchInfos = async (users, info) => {
  if (!users.length) {
    return info;
  }

  const parallel = 45;
  const runUsers = users.slice(0, parallel);
  const newInfo = (await Promise.all(runUsers.map(u =>
    fetchInfo(u)
      .catch((e) => {
        console.error(e);
        return [];
      }))))
    .reduce((acc, val) => acc.concat(val), []);
  console.log(`next batch, users left: ${users.length}`);
  return fetchInfos(users.slice(parallel), info.concat(newInfo));
};

const run = async () => {
  const users = await db.select('user_id', 'provider', 'provider_id', 'access_token', 'refresh_token', 'expires_in')
    .from('providers')
    .map(toCamelCase);
  return fetchInfos(users, []);
};

run()
  .then(res => fs.writeFileSync('users.json', JSON.stringify(res), 'utf8'))
  .catch(console.error)
  .then(process.exit);

