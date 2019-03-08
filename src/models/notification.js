import db, { toCamelCase, toSnakeCase } from '../db';

const table = 'notifications';

const get = (since) => {
  const select = db.select().from(table);
  const query = since ? select.where('timestamp', '>', since) : select;
  return query.orderBy('timestamp', 'DESC').limit(5).map(toCamelCase);
};

const getLatest = () =>
  db.select().from(table).orderBy('timestamp', 'DESC').limit(1)
    .map(toCamelCase)
    .then(res => (res.length ? res[0] : null));

const add = obj => db.insert(toSnakeCase(obj)).into(table)
  .then(() => obj);

export default { get, getLatest, add };
