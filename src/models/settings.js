import db, { toCamelCase, toSnakeCase } from '../db';

const table = 'settings';

const getByUserId = userId =>
  db.select()
    .from(table)
    .where('user_id', '=', userId)
    .limit(1)
    .map(toCamelCase)
    .map(row => Object.assign({}, row, {
      enableCardAnimations: row.enableCardAnimations === 1,
      showTopSites: row.showTopSites === 1,
      insaneMode: row.insaneMode === 1,
      appInsaneMode: row.appInsaneMode === 1,
      showOnlyNotReadPosts: row.showOnlyNotReadPosts === 1,
    }))
    .then((res) => {
      if (res.length) {
        const set = res[0];
        delete set.updatedAt;
        return set;
      }

      return null;
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
