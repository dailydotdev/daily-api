import db, { toCamelCase, toSnakeCase } from '../db';
import config from '../config';

const table = 'posts';

const select = () =>
  db.select(
    `${table}.id`, `${table}.title`, `${table}.url`, `${table}.image`, `${table}.published_at`, `${table}.created_at`,
    'publications.id as pub_id', 'publications.image as pub_image', 'publications.name as pub_name',
  )
    .from(table)
    .join('publications', `${table}.publication_id`, 'publications.id');

// eslint-disable-next-line arrow-body-style
const mapPost = (post) => {
  return {
    id: post.id,
    title: post.title,
    url: post.url,
    image: post.image ? post.image : config.defaultImage,
    publishedAt: post.publishedAt,
    createdAt: post.createdAt,
    publication: {
      id: post.pubId,
      name: post.pubName,
      image: post.pubImage,
    },
  };
};

const getLatest = (latest, page, pageSize) =>
  select()
    .where(`${table}.created_at`, '<=', latest)
    .orderBy(`${table}.created_at`, 'desc')
    .offset(page * pageSize)
    .limit(pageSize)
    .map(toCamelCase)
    .map(mapPost);

const get = id =>
  select()
    .where(`${table}.id`, '=', id)
    .limit(1)
    .map(toCamelCase)
    .map(mapPost)
    .then(res => (res.length ? res[0] : null));

const add = (id, title, url, publicationId, publishedAt, createdAt, image) => {
  const obj = {
    id, title, url, publicationId, publishedAt, createdAt, image,
  };
  return db.insert(toSnakeCase(obj)).into(table)
    .then(() => obj);
};

export default { getLatest, get, add };
