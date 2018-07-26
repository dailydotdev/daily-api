import db, { toCamelCase, toSnakeCase } from '../db';

const table = 'settings';

const getByUserId = userId =>
  db.select()
    .from(table)
    .where('user_id', '=', userId)
    .limit(1)
    .map(toCamelCase)
    .then(res => (res.length ? res[0] : null))
    .then((res) => {
      delete res.updatedAt;
      return res;
    });

const upsert = (settings) => {
  const obj = toSnakeCase(Object.assign({
    updatedAt: new Date(),
  }, settings));

  const insert = db(table).insert(obj).toString();
  const update = db(table).update(obj).toString().replace(/^update .* set /i, '');
  return db.raw(`${insert} on duplicate key update ${update}`).then(() => settings);
};

export default {
  getByUserId,
  upsert,
};
