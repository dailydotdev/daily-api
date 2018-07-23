import crypto from 'crypto';
import db, { toCamelCase, toSnakeCase } from '../db';

const table = 'refresh_tokens';

const generate = userId => `${userId}.${crypto.randomBytes(40).toString('hex')}`;

const getByToken = token =>
  db.select('user_id', 'token')
    .from(table)
    .where('token', '=', token)
    .limit(1)
    .map(toCamelCase)
    .then(res => (res.length ? res[0] : null));

const add = (userId, token) => {
  const obj = {
    userId,
    token,
  };

  return db.insert(toSnakeCase(Object.assign({
    createdAt: new Date(),
  }, obj))).into(table).then(() => obj);
};

export default {
  generate,
  getByToken,
  add,
};
