import db, { toCamelCase, toSnakeCase } from '../db';

const table = 'sources';

const getAll = () => db.select().from(table).map(toCamelCase);

const add = (publicationId, url) => {
  const obj = { publicationId, url };
  return db.insert(toSnakeCase(obj)).into(table)
    .then(() => obj);
};

export default { getAll, add };
