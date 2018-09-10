import db, { toCamelCase, toSnakeCase } from '../db';

const table = 'notifications';

const get = (since) => {
  const select = db.select().from(table);
  const query = since ? select.where('timestamp', '>=', since) : select;
  return query.orderBy('timestamp', 'ASC').limit(5).map(toCamelCase);
};

const add = obj => db.insert(toSnakeCase(obj)).into(table)
  .then(() => obj);

export default { get, add };
