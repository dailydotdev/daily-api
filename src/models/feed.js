import db, { toCamelCase, toSnakeCase } from '../db';

const table = 'feeds';

const getByUserId = userId =>
  db.select()
    .from(table)
    .where('user_id', '=', userId)
    .map(toCamelCase)
    .map(res => Object.assign({}, res, { enabled: res.enabled === 1 }));

const upsert = (feed) => {
  const obj = feed.map(toSnakeCase);

  const insert = db(table).insert(obj).toString();
  return db.raw(`${insert} on duplicate key update enabled = VALUES(enabled), publication_id = VALUES(publication_id)`)
    .then(() => feed);
};

export default {
  getByUserId,
  upsert,
};
