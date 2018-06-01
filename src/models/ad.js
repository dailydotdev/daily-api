import db, { toSnakeCase } from '../db';

const table = 'ads';

const add = (
  id, title, url, source, start, end,
  image, ratio, placeholder,
) => {
  const obj = {
    id, title, url, source, start, end, image, ratio, placeholder,
  };
  return db.insert(toSnakeCase(obj)).into(table)
    .then(() => obj);
};

const getEnabledAds = (timestamp = new Date()) =>
  db.select(
    `${table}.id`, `${table}.title`, `${table}.url`, `${table}.image`,
    `${table}.ratio`, `${table}.placeholder`, `${table}.source`,
  )
    .from(table)
    .where(`${table}.start`, '<=', timestamp)
    .andWhere(`${table}.end`, '>', timestamp);


export default {
  add,
  getEnabledAds,
};
