import db, { toCamelCase, toSnakeCase } from '../db';
import config from '../config';

const table = 'posts';

const select = (timestamp = new Date()) =>
  db.select(
    `${table}.id`, `${table}.title`, `${table}.url`, `${table}.image`, `${table}.published_at`, `${table}.created_at`,
    `${table}.ratio`, `${table}.placeholder`, 'ranked.views',
    'publications.id as pub_id', 'publications.image as pub_image', 'publications.name as pub_name',
  )
    .from(function groupEvents() {
      this.select('post_id as id')
        .countDistinct('user_id as views')
        .from('events')
        .where('type', '=', 'view')
        .groupBy('post_id')
        .where('timestamp', '<=', timestamp)
        .as('ranked');
    }).as('ignored')
    .rightJoin(table, `${table}.id`, 'ranked.id')
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
  select(latest)
    .where(`${table}.created_at`, '<=', latest)
    .andWhere(...whereByPublications(publications))
    .orderByRaw(`timestampdiff(second, ${table}.created_at, current_timestamp()) - coalesce(ranked.views, 0) * 12 * 60 ASC`)
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

const getPostToTweet = async () => {
  const res = await db.select(`${table}.id`, `${table}.title`, `${table}.image`, 'publications.twitter')
    .from(function groupEvents() {
      this.select('post_id as id')
        .countDistinct('user_id as views')
        .from('events')
        .where('type', '=', 'view')
        .groupBy('post_id')
        .as('ranked');
    }).as('ignored')
    .join(table, `${table}.id`, 'ranked.id')
    .join('publications', `${table}.publication_id`, 'publications.id')
    .where(`${table}.tweeted`, '=', 0)
    .andWhere('ranked.views', '>=', 30)
    .orderBy('created_at')
    .limit(1);
  return res.length ? res[0] : null;
};

const setPostsAsTweeted = id =>
  db(table).where('id', '=', id).update({ tweeted: 1 });

export default {
  getLatest,
  get,
  add,
  getPostToTweet,
  setPostsAsTweeted,
};
