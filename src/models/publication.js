import db from '../db';

const table = 'publications';

const getAll = () => db.select().from(table).orderBy('name');

const add = (name, image) => {
  const id = name.toLowerCase().replace(' ', '_').replace('\'', '');
  const obj = { id, name, image };
  return db.insert(obj).into(table)
    .then(() => obj);
};

export default { getAll, add };
