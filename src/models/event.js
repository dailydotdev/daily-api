import db, { toCamelCase, toSnakeCase } from '../db';

const table = 'events';

const getAll = () => db.select().from(table).map(toCamelCase);

const add = (type, userId, postId, referer, agent, ip, timestamp = new Date()) => {
  const obj = {
    type, userId, postId, referer, agent, ip, timestamp,
  };
  return db.insert(toSnakeCase(obj)).into(table)
    .then(() => obj);
};

export default { getAll, add };
