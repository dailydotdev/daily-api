import _ from 'lodash';

import db, { toCamelCase, toSnakeCase } from '../db';
import config from '../config';
import tag from './tag';
import feed from './feed';

const table = 'posts';
const tagsTable = 'tags';
const bookmarksTable = 'bookmarks';

const select = (...additional) =>
  db.select(
    `${table}.id`, `${table}.title`, `${table}.url`, `${table}.image`, `${table}.published_at`, `${table}.created_at`,
    `${table}.ratio`, `${table}.placeholder`, `${table}.views`, `${table}.read_time`,
    'publications.id as pub_id', 'publications.image as pub_image', 'publications.name as pub_name', ...additional,
    db.select(db.raw(`GROUP_CONCAT(${tagsTable}.tag ORDER BY tags_count.count DESC SEPARATOR ',')`))
      .from(tagsTable)
      .join('tags_count', `${tagsTable}.tag`, 'tags_count.tag')
      .where(`${tagsTable}.post_id`, '=', db.raw(`\`${table}\`.\`id\``))
      .groupBy(`${tagsTable}.post_id`)
      .as('tags'),
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

  const index = post.createdAt.getTime() % config.defaultImage.url.length;

  return {
    image: config.defaultImage.url[index],
    ratio: config.defaultImage.ratio,
    placeholder: config.defaultImage.placeholder,
  };
};

const getTimeLowerBounds = latest => new Date(latest - (10 * 24 * 60 * 60 * 1000));

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
    views: post.views || 0,
    tags: post.tags ? post.tags.split(',') : [],
    readTime: post.readTime,
  }, mapImage(post), mapBookmark(post));

const whereByPublications = (publications) => {
  if (publications && publications.length > 0) {
    return ['publications.id', 'in', publications];
  }

  return ['publications.enabled', '=', 1];
};

const filterByTags = (query, tags) => {
  if (tags && tags.length > 0) {
    const tagsQuery = db.select(db.raw('1'))
      .from(tagsTable)
      .where('tag', 'in', tags)
      .andWhere('post_id', '=', db.raw(`${table}.id`));
    return query.whereExists(tagsQuery);
  }

  return query;
};

const getLatest = (latest, page, pageSize, publications, tags) =>
  filterByTags(
    select()
      .where(`${table}.created_at`, '<=', latest)
      .andWhere(`${table}.created_at`, '>', getTimeLowerBounds(latest))
      .andWhere(...whereByPublications(publications))
      .orderByRaw(`timestampdiff(minute, ${table}.created_at, current_timestamp()) - POW(LOG(${table}.views * 0.55 + 1), 2) * 60 ASC`)
      .offset(page * pageSize)
      .limit(pageSize),
    tags,
  )
    .map(toCamelCase)
    .map(mapPost);

const selectWithBookmarked = userId =>
  select(db.raw(`${bookmarksTable}.post_id IS NOT NULL as bookmarked`))
    .leftJoin(bookmarksTable, builder =>
      builder.on(`${bookmarksTable}.post_id`, '=', `${table}.id`).andOn(`${bookmarksTable}.user_id`, '=', db.raw('?', [userId])));

const getFeed = (latest, page, pageSize, userId) =>
  (userId ? selectWithBookmarked(userId) : select())
    .where(`${table}.created_at`, '<=', latest)
    .offset(page * pageSize)
    .limit(pageSize);

const getByPublication = (latest, page, pageSize, publication, userId) =>
  getFeed(latest, page, pageSize, userId)
    .andWhere('publications.id', '=', publication)
    .orderBy(`${table}.created_at`, 'DESC')
    .map(toCamelCase)
    .map(mapPost);

const getByTag = (latest, page, pageSize, tagName, userId) =>
  getFeed(latest, page, pageSize, userId)
    .join(tagsTable, `${tagsTable}.post_id`, `${table}.id`)
    .andWhere(`${tagsTable}.tag`, '=', tagName)
    .orderBy(`${table}.created_at`, 'DESC')
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
 * @param {Number} [obj.readTime] - Read time estimation
 */
const add = obj =>
  db.transaction(async (trx) => {
    await trx.insert(toSnakeCase(Object.assign({ views: 0 }, _.omit(obj, 'tags')))).into(table);
    return tag.addPostTags((obj.tags || []).map(t => ({ postId: obj.id, tag: t })), trx);
  }).then(() => obj);

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

const getUserLatest = async (latest, page, pageSize, userId) => {
  const tags = (await feed.getUserTags(userId)).map(t => t.tag);
  return filterByTags(
    getFeed(latest, page, pageSize, userId)
      .leftJoin('feeds', builder =>
        builder.on('feeds.publication_id', '=', `${table}.publication_id`).andOn('feeds.user_id', '=', db.raw('?', [userId])))
      .andWhere(`${table}.created_at`, '>', getTimeLowerBounds(latest))
      .andWhere(builder => builder.where('feeds.enabled', '=', 1).orWhere(builder2 =>
        builder2.whereNull('feeds.enabled').andWhere('publications.enabled', '=', 1)))
      .orderByRaw(`timestampdiff(minute, ${table}.created_at, current_timestamp()) - POW(LOG(${table}.views * 0.55 + 1), 2) * 60 ASC`),
    tags,
  )
    .map(toCamelCase)
    .map(mapPost);
};

const getToilet = (latest, page, pageSize, userId) =>
  getFeed(latest, page, pageSize, userId)
    .leftJoin('feeds', builder =>
      builder.on('feeds.publication_id', '=', `${table}.publication_id`).andOn('feeds.user_id', '=', db.raw('?', [userId])))
    .andWhere(`${table}.created_at`, '>', getTimeLowerBounds(latest))
    .andWhereRaw(`timestampdiff(hour, ${table}.created_at, current_timestamp()) <= 24`)
    .andWhere(builder => builder.where('feeds.enabled', '=', 1).orWhere(builder2 =>
      builder2.whereNull('feeds.enabled').andWhere('publications.enabled', '=', 1)))
    .andWhereRaw(`${bookmarksTable}.post_id IS NULL`)
    .orderBy(`${table}.created_at`, 'DESC')
    .map(toCamelCase)
    .map(mapPost);

const removeBookmark = (userId, postId) =>
  db(bookmarksTable).where(toSnakeCase({ userId, postId })).delete();

export default {
  getLatest,
  getByPublication,
  getByTag,
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
