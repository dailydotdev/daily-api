import db, { toCamelCase, toSnakeCase } from '../db';

const table = 'providers';

const select = () =>
  db.select('user_id', 'provider', 'provider_id', 'access_token', 'refresh_token', 'expires_in').from(table);

const getByProviderId = (providerId, provider) =>
  select()
    .where('provider_id', '=', providerId).andWhere('provider', '=', provider)
    .limit(1)
    .map(toCamelCase)
    .then(res => (res.length ? res[0] : null));

const getByUserId = userId =>
  select()
    .where('user_id', '=', userId)
    .orderBy('created_at', 'asc')
    .limit(1)
    .map(toCamelCase)
    .then(res => (res.length ? res[0] : null));

const add = (userId, provider, accessToken, providerId, expiresIn, refreshToken) => {
  const obj = {
    userId,
    provider,
    accessToken,
    providerId,
    expiresIn,
    refreshToken,
  };
  return db.insert(toSnakeCase(Object.assign({
    createdAt: new Date(),
    updatedAt: new Date(),
  }, obj))).into(table).then(() => obj);
};

const updateToken = (userId, provider, accessToken, expiresIn) =>
  db(table)
    .where('user_id', '=', userId)
    .andWhere('provider', '=', provider)
    .update(toSnakeCase({ accessToken, updatedAt: new Date(), expiresIn }));

export default {
  getByProviderId,
  getByUserId,
  add,
  updateToken,
};
