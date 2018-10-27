import _ from 'lodash';

import db, { toCamelCase, toSnakeCase } from '../db';
import config from '../config';

const table = 'posts';
const tagsTable = 'tags';
const bookmarksTable = 'bookmarks';

const select = (...additional) =>
  db.select(
    `${table}.id`, `${table}.title`, `${table}.url`, `${table}.image`, `${table}.published_at`, `${table}.created_at`,
    `${table}.ratio`, `${table}.placeholder`,
    'publications.id as pub_id', 'publications.image as pub_image', 'publications.name as pub_name', ...additional,
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

const mapBookmark = (post) => {
  if (post.bookmarked) {
    return { bookmarked: post.bookmarked === 1 };
  }

  return {};
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
  }, mapImage(post), mapBookmark(post));

const whereByPublications = (publications) => {
  if (publications && publications.length > 0) {
    return ['publications.id', 'in', publications];
  }

  return ['publications.enabled', '=', 1];
};

const getLatest = (latest, page, pageSize, publications) =>
  select()
    .where(`${table}.created_at`, '<=', latest)
    .andWhere(...whereByPublications(publications))
    .orderByRaw(`timestampdiff(minute, ${table}.created_at, current_timestamp()) - POW(LOG(${table}.views + 1), 2) * 60 ASC`)
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

/**
 * Add new post to database
 * @param {Object} obj - The post to add.
 * @param {String} obj.id
 * @param {String} obj.title
 * @param {String} obj.url
 * @param {String} obj.publicationId
 * @param {Date} obj.publishedAt - When the post was published
 * @param {Date} obj.createdAt - When the post was created in our database
 * @param {String} obj.image
 * @param {Number} obj.ratio - Image width to height ratio
 * @param {String} obj.placeholder - Base64 image placeholder
 * @param {Boolean} [obj.promoted] - Whether the post is promoted
 * @param {Number} [obj.views] - Number of views
 * @param {String[]} [obj.tags]
 * @param {String} [obj.twitterSite] - Twitter handle of the publication
 * @param {String} [obj.twitterCreator] - Twitter handle of the author
 */
const add = obj =>
  db.transaction(async (trx) => {
    await trx.insert(toSnakeCase(Object.assign({ views: 0 }, _.omit(obj, 'tags')))).into(table);
    return trx.insert((obj.tags || []).map(tag => ({ post_id: obj.id, tag }))).into(tagsTable);
  }).then(() => _.omit(obj, 'tags'));

const getPostToTweet = async () => {
  const res = await db.select(`${table}.id`, `${table}.title`, `${table}.image`, `${table}.site_twitter`, `${table}.creator_twitter`, 'publications.twitter')
    .from(table)
    .join('publications', `${table}.publication_id`, 'publications.id')
    .where(`${table}.tweeted`, '=', 0)
    .andWhere(`${table}.views`, '>=', 30)
    .orderBy('created_at')
    .limit(1)
    .map(toCamelCase);
  return res.length ? res[0] : null;
};

const getPostTags = id =>
  db.select('tag')
    .from(tagsTable)
    .where('post_id', '=', id)
    .map(res => res.tag);

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

const getBookmarks = (latest, page, pageSize, userId) =>
  select()
    .join(bookmarksTable, `${table}.id`, `${bookmarksTable}.post_id`)
    .where(`${bookmarksTable}.created_at`, '<=', latest)
    .andWhere(`${bookmarksTable}.user_id`, '=', userId)
    .orderByRaw(`${bookmarksTable}.created_at DESC`)
    .offset(page * pageSize)
    .limit(pageSize)
    .map(toCamelCase)
    .map(mapPost);

const bookmark = (bookmarks) => {
  const obj = bookmarks.map(b => toSnakeCase(Object.assign({ createdAt: new Date() }, b)));

  return db.insert(obj)
    .into(bookmarksTable).then(() => bookmarks);
};

const getUserLatest = (latest, page, pageSize, userId) =>
  select(db.raw(`${bookmarksTable}.post_id IS NOT NULL as bookmarked`))
    .leftJoin('feeds', builder =>
      builder.on('feeds.publication_id', '=', `${table}.publication_id`).andOn('feeds.user_id', '=', db.raw('?', [userId])))
    .leftJoin(bookmarksTable, builder =>
      builder.on(`${bookmarksTable}.post_id`, '=', `${table}.id`).andOn(`${bookmarksTable}.user_id`, '=', db.raw('?', [userId])))
    .where(`${table}.created_at`, '<=', latest)
    .andWhere(builder => builder.where('feeds.enabled', '=', 1).orWhere(builder2 =>
      builder2.whereNull('feeds.enabled').andWhere('publications.enabled', '=', 1)))
    .orderByRaw(`timestampdiff(minute, ${table}.created_at, current_timestamp()) - POW(LOG(${table}.views + 1), 2) * 60 ASC`)
    .offset(page * pageSize)
    .limit(pageSize)
    .map(toCamelCase)
    .map(mapPost);

const getToilet = (latest, page, pageSize, userId) =>
  select(db.raw(`${bookmarksTable}.post_id IS NOT NULL as bookmarked`))
    .leftJoin('feeds', builder =>
      builder.on('feeds.publication_id', '=', `${table}.publication_id`).andOn('feeds.user_id', '=', db.raw('?', [userId])))
    .leftJoin(bookmarksTable, builder =>
      builder.on(`${bookmarksTable}.post_id`, '=', `${table}.id`).andOn(`${bookmarksTable}.user_id`, '=', db.raw('?', [userId])))
    .where(`${table}.created_at`, '<=', latest)
    .andWhereRaw(`timestampdiff(hour, ${table}.created_at, current_timestamp()) <= 24`)
    .andWhere(builder => builder.where('feeds.enabled', '=', 1).orWhere(builder2 =>
      builder2.whereNull('feeds.enabled').andWhere('publications.enabled', '=', 1)))
    .andWhereRaw(`${bookmarksTable}.post_id IS NULL`)
    .orderBy(`${table}.created_at`, 'DESC')
    .offset(page * pageSize)
    .limit(pageSize)
    .map(toCamelCase)
    .map(mapPost);

const removeBookmark = (userId, postId) =>
  db(bookmarksTable).where(toSnakeCase({ userId, postId })).delete();

export default {
  getLatest,
  getPromoted,
  get,
  add,
  getPostToTweet,
  setPostsAsTweeted,
  updateViews,
  getBookmarks,
  bookmark,
  removeBookmark,
  getUserLatest,
  getPostTags,
  getToilet,
};
