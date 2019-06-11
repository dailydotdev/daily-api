import db from '../db';

const table = 'publications';

const mapPub = pub => Object.assign({}, pub, { enabled: pub.enabled === 1 });

const getAll = () => db.select().from(table).orderBy('name').map(mapPub);

const getEnabled = () => db.select().from(table).where('enabled', '=', 1).orderBy('name')
  .map(mapPub);

const add = (name, image, enabled, twitter, id = null) => {
  const obj = {
    id: id || name.toLowerCase().replace(' ', '_').replace('\'', ''),
    name,
    image,
    enabled: enabled ? 1 : 0,
    twitter,
  };
  return db.insert(obj).into(table)
    .then(() => mapPub(obj));
};

export default { getAll, getEnabled, add };
