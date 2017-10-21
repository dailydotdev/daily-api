import db, { toCamelCase, toSnakeCase } from '../db';

const table = 'posts';

const getLatest = (latest, page, pageSize) =>
  db.select(
    `${table}.id`, `${table}.title`, `${table}.url`, `${table}.image`, `${table}.published_at`,
    'publications.id as pub_id', 'publications.image as pub_image', 'publications.name as pub_name',
  ).from(table)
    .join('publications', `${table}.publication_id`, 'publications.id')
    .where(`${table}.published_at`, '<=', latest)
    .orderBy(`${table}.published_at`, 'desc')
    .offset(page * pageSize)
    .limit(pageSize)
    .map(toCamelCase)
    // eslint-disable-next-line arrow-body-style
    .map((post) => {
      return {
        id: post.id,
        title: post.title,
        url: post.url,
        image: post.image ? post.image : post.pubImage,
        publishedAt: post.publishedAt,
        publication: {
          id: post.pubId,
          name: post.pubName,
        },
      };
    });

const add = (id, title, url, publicationId, publishedAt, image) => {
  const obj = {
    id, title, url, publicationId, publishedAt, image,
  };
  return db.insert(toSnakeCase(obj)).into(table)
    .then(() => obj);
};

export default { getLatest, add };
