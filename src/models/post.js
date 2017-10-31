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

const add = (id, title, url, publicationId, publishedAt, createdAt, image, ratio, placeholder) => {
  const obj = {
    id, title, url, publicationId, publishedAt, createdAt, image, ratio, placeholder,
  };
  return db.insert(toSnakeCase(obj)).into(table)
    .then(() => obj);
};

export default { getLatest, get, add };
