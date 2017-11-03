import db from '../db';

const table = 'publications';

const mapPub = pub => Object.assign({}, pub, { enabled: pub.enabled === 1 });

const getAll = () => db.select().from(table).orderBy('name').map(mapPub);

const add = (name, image, enabled) => {
  const id = name.toLowerCase().replace(' ', '_').replace('\'', '');
  const obj = {
    id,
    name,
    image,
    enabled: enabled ? 1 : 0,
  };
  return db.insert(obj).into(table)
    .then(() => mapPub(obj));
};

export default { getAll, add };
