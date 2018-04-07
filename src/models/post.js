import db, { toCamelCase, toSnakeCase } from '../db';
import config from '../config';

const table = 'posts';

const select = () =>
  db.select(
    `${table}.id`, `${table}.title`, `${table}.url`, `${table}.image`, `${table}.published_at`, `${table}.created_at`,
    `${table}.ratio`, `${table}.placeholder`,
    'publications.id as pub_id', 'publications.image as pub_image', 'publications.name as pub_name',
  )
    .from(table)
    .join('publications', `${table}.publication_id`, 'publications.id');

const mapImage = (post) => {
  if (post.image) {
    return {
      image: post.image,
      ratio: post.ratio,
      placeholder: post.placeholder,
    };
  }

  return {
    image: config.defaultImage.url,
    ratio: config.defaultImage.ratio,
    placeholder: config.defaultImage.placeholder,
  };
};

const mapPost = post =>
  Object.assign({}, {
    id: post.id,
    title: post.title,
    url: post.url,
    publishedAt: post.publishedAt,
    createdAt: post.createdAt,
    publication: {
      id: post.pubId,
      name: post.pubName,
      image: post.pubImage,
    },
  }, mapImage(post));

const whereByPublications = (publications) => {
  if (publications && publications.length > 0) {
    return ['publications.id', 'in', publications];
  }

  return ['publications.enabled', '=', 1];
};

const getLatest = (latest, page, pageSize, publications) =>
  select()
    .where(`${table}.created_at`, '<=', latest)
    .andWhere(`${table}.promoted`, '=', 0)
    .andWhere(...whereByPublications(publications))
    .orderByRaw(`timestampdiff(second, ${table}.created_at, current_timestamp()) - ${table}.views * 12 * 60 ASC`)
    .offset(page * pageSize)
    .limit(pageSize)
    .map(toCamelCase)
    .map(mapPost);

const getPromoted = () =>
  select()
    .where(`${table}.promoted`, '=', 1)
    .map(toCamelCase)
    .map(mapPost);

const get = id =>
  select()
    .where(`${table}.id`, '=', id)
    .limit(1)
    .map(toCamelCase)
    .map(mapPost)
    .then(res => (res.length ? res[0] : null));

const add = (
  id, title, url, publicationId, publishedAt, createdAt,
  image, ratio, placeholder, promoted = false, views = 0,
) => {
  const obj = {
    id, title, url, publicationId, publishedAt, createdAt, image, ratio, placeholder, promoted,
  };
  return db.insert(toSnakeCase(Object.assign({}, obj, { views }))).into(table)
    .then(() => obj);
};

const getPostToTweet = async () => {
  const res = await db.select(`${table}.id`, `${table}.title`, `${table}.image`, 'publications.twitter')
    .from(table)
    .join('publications', `${table}.publication_id`, 'publications.id')
    .where(`${table}.tweeted`, '=', 0)
    .andWhere(`${table}.promoted`, '=', 0)
    .andWhere(`${table}.views`, '>=', 30)
    .orderBy('created_at')
    .limit(1);
  return res.length ? res[0] : null;
};

const setPostsAsTweeted = id =>
  db(table).where('id', '=', id).update({ tweeted: 1 });

const updateViews = async () => {
  const before = new Date();

  return db.transaction(async (trx) => {
    const res = await trx.select('timestamp').from('config').where('key', '=', 'last_views_update');
    const after = res.length ? res[0].timestamp : new Date(0);
    await trx.raw('UPDATE posts p INNER JOIN (SELECT COUNT(DISTINCT user_id) count, post_id FROM events WHERE type = "view" AND timestamp >= ? AND timestamp < ? GROUP BY post_id) AS e ON p.id = e.post_id SET p.views = p.views + e.count', [after, before]);
    return trx.raw('INSERT INTO config (`key`, `timestamp`) VALUES (\'last_views_update\', ?) ON DUPLICATE KEY UPDATE timestamp = ?', [before, before]);
  });
};

export default {
  getLatest,
  getPromoted,
  get,
  add,
  getPostToTweet,
  setPostsAsTweeted,
  updateViews,
};
