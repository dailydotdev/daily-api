import db, { toCamelCase, toSnakeCase } from '../db';

const table = 'providers';

const get = (userId, provider) =>
  db.select().from(table)
    .where('user_id', '=', userId).andWhere('provider', '=', provider)
    .limit(1)
    .map(toCamelCase)
    .then(res => (res.length ? res[0] : null));

const add = (userId, provider, accessToken) => {
  const obj = { userId, provider, accessToken };
  return db.insert(toSnakeCase(obj)).into(table).then(() => obj);
};

export default {
  get,
  add,
};
