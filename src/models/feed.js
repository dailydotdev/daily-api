import db, { toCamelCase, toSnakeCase } from '../db';

const table = 'feeds';
const userTagsTable = 'user_tags';

const getUserPublications = userId =>
  db.select()
    .from(table)
    .where('user_id', '=', userId)
    .map(toCamelCase)
    .map(res => Object.assign({}, res, { enabled: res.enabled === 1 }));

const upsertUserPublications = (feed) => {
  const obj = feed.map(toSnakeCase);

  const insert = db(table).insert(obj).toString();
  return db.raw(`${insert} on duplicate key update enabled = VALUES(enabled), publication_id = VALUES(publication_id)`)
    .then(() => feed);
};

const getUserTags = userId =>
  db.select()
    .from(userTagsTable)
    .where('user_id', '=', userId)
    .map(toCamelCase);

const addUserTags = (tags) => {
  const obj = tags.map(toSnakeCase);
  return db(userTagsTable).insert(obj).then(() => tags);
};

const removeUserTags = (tag, userId) =>
  db(userTagsTable).where('user_id', '=', userId).andWhere('tag', '=', tag).delete();

export default {
  getUserPublications,
  upsertUserPublications,
  getUserTags,
  addUserTags,
  removeUserTags,
};
