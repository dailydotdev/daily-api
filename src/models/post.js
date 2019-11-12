import _ from 'lodash';

import db, { toCamelCase, toSnakeCase } from '../db';
import config from '../config';
import { initAlgolia } from '../algolia';
import tag from './tag';
import feed from './feed';

const table = 'posts';
const tagsTable = 'tags';
const bookmarksTable = 'bookmarks';
const eventsTable = 'events';
const hideTable = 'hidden_posts';

const nonEmptyArray = array => array && array.length;

const getTimeLowerBounds = latest => new Date(latest - (10 * 24 * 60 * 60 * 1000));

const mapPost = fields => (post) => {
  let newPost = _.omit(post, ['tags', 'pubId', 'pubName', 'pubImage', 'bookmarked', 'image', 'ratio', 'placeholder']);

  if (fields.indexOf('views') > -1 && !post.views) {
    newPost.views = 0;
  }
  if (fields.indexOf('tags') > -1) {
    newPost.tags = post.tags ? post.tags.split(',') : [];
  }

  if (fields.indexOf('publication') > -1) {
    newPost = Object.assign({}, newPost, {
      publication: {
        id: post.pubId,
        name: post.pubName,
        image: post.pubImage,
      },
    });
  }

  if (fields.indexOf('bookmarked') > -1) {
    newPost.bookmarked = post.bookmarked === 1;
  }
  if (fields.indexOf('read') > -1) {
    newPost.read = post.read === 1;
  }

  if (fields.indexOf('image') > -1) {
    if (post.image) {
      newPost = Object.assign({}, newPost, {
        image: post.image,
        ratio: post.ratio,
        placeholder: post.placeholder,
      });
    } else {
      // Set default image
      const index = Math.floor(post.createdAt.getTime() / 1000) % config.defaultImage.url.length;
      newPost = Object.assign({}, newPost, {
        image: config.defaultImage.url[index],
        ratio: config.defaultImage.ratio,
        placeholder: config.defaultImage.placeholder,
      });
    }
  }

  return newPost;
};

const renameKey = (obj, oldKey, newKey) =>
  _.assign(_.omit(obj, [oldKey]), { [newKey]: obj[oldKey] });

const searchPosts = async (query, opts, trackingId, ip) => {
  const { index } = initAlgolia('posts', trackingId, ip);
  const res = await index.search(Object.assign({}, { query }, opts));
  return res.hits.map(obj => _.pick(renameKey(obj, 'objectID', 'id'), ['id', 'title']));
};

/**
 * Generate select tags query
 * @returns Knex query object
 */
const getTags = () => db.select(db.raw(`GROUP_CONCAT(${tagsTable}.tag ORDER BY tags_count.count DESC SEPARATOR ',')`))
  .from(tagsTable)
  .join('tags_count', `${tagsTable}.tag`, 'tags_count.tag')
  .where(`${tagsTable}.post_id`, '=', db.raw(`\`${table}\`.\`id\``))
  .groupBy(`${tagsTable}.post_id`)
  .as('tags');

const didRead = userId => db(eventsTable)
  .count('*')
  .where(`${eventsTable}.type`, '=', 'view')
  .andWhere(`${eventsTable}.user_id`, '=', userId)
  .andWhere(`${eventsTable}.post_id`, '=', db.raw(`\`${table}\`.\`id\``))
  .as('read');

/**
 * Dictionary which maps a single field to a query
 * A query can be a string, array of strings or a function
 */
const singleFieldToQuery = {
  id: `${table}.id`,
  title: `${table}.title`,
  url: `${table}.url`,
  image: [`${table}.image`, `${table}.ratio`, `${table}.placeholder`],
  publishedAt: `${table}.published_at`,
  createdAt: `${table}.created_at`,
  views: `${table}.views`,
  readTime: `${table}.read_time`,
  publication: ['publications.id as pub_id', 'publications.image as pub_image', 'publications.name as pub_name'],
  siteTwitter: `${table}.site_twitter`,
  creatorTwitter: `${table}.creator_twitter`,
  publicationTwitter: 'publications.twitter',
  tags: getTags,
  bookmarked: () => db.raw(`${bookmarksTable}.post_id IS NOT NULL as bookmarked`),
  read: didRead,
};

const defaultAnonymousFields = [
  'id', 'title', 'url', 'publishedAt', 'createdAt', 'image',
  'views', 'readTime', 'publication', 'tags',
];
const defaultUserFields = [...defaultAnonymousFields, 'bookmarked'];

/**
 * Converts an array of fields to an array of parameters to knex select
 * @param {String[]} fields Fields to include in the response
 * @param {?String} userId Id of the user who requested the feed
 * @returns {Object[]} Array of select parameters
 */
const fieldsToSelect = (fields, userId) => fields.reduce((acc, field) => {
  const query = singleFieldToQuery[field];
  if (query) {
    let toAdd;
    if (_.isFunction(query)) {
      toAdd = query(userId);
    } else {
      toAdd = query;
    }
    if (_.isArray(toAdd)) {
      return acc.concat(toAdd);
    }
    acc.push(toAdd);
  }
  return acc;
}, []);

/**
 * Adds the given filters to the query as a where statement
 * @param query Knex query object
 * @param {Object} filters Object containing the filters to apply
 * @param {?String} rankBy Order criteria
 * @param {?String} userId Id of the user who requested the feed
 * @param {?Boolean} ignoreUserFilters Whether to ignore the user's preferences
 * @returns * Knex query object
 */
const filtersToQuery = async (query, filters = {}, rankBy, userId, ignoreUserFilters) => {
  let newQuery = query;

  if (filters.postId) {
    newQuery = newQuery.where(`${table}.id`, '=', filters.postId);
  } else if (filters.postIds) {
    newQuery = newQuery.whereIn(`${table}.id`, filters.postIds);
  } else {
    const where = [
      ['publications.enabled', '=', 1],
    ];

    if (filters.before) {
      where.push([`${table}.created_at`, '<', filters.before]);
    }

    if (filters.after || rankBy === 'popularity') {
      // in case we rank by popularity we must set lower bounds for better performance
      const after = rankBy === 'popularity' ?
        getTimeLowerBounds(filters.before || new Date()) : filters.after;
      where.push([`${table}.created_at`, '>', after]);
    }

    if (filters.publications) {
      if (nonEmptyArray(filters.publications.include)) {
        where.push(['publications.id', 'in', filters.publications.include]);
      }
      if (nonEmptyArray(filters.publications.exclude)) {
        where.push(['publications.id', 'not in', filters.publications.exclude]);
      }
    } else if (userId && !ignoreUserFilters) {
      // Filter by the publication preferences of the user
      newQuery = newQuery.leftJoin('feeds', builder =>
        builder.on('feeds.publication_id', '=', `${table}.publication_id`)
          .andOn('feeds.user_id', '=', db.raw('?', [userId])));

      where.push([builder => builder.where('feeds.enabled', '=', 1).orWhere(builder2 =>
        builder2.whereNull('feeds.enabled').andWhere('publications.enabled', '=', 1))]);
    }

    if (userId) {
      // Remove hidden posts from feed
      newQuery = newQuery.leftJoin(hideTable, builder =>
        builder.on(`${hideTable}.post_id`, '=', `${table}.id`)
          .andOn(`${hideTable}.user_id`, '=', db.raw('?', [userId])));

      where.push([db.raw(`${hideTable}.post_id IS NULL`)]);
    }

    newQuery = where.reduce((q, filter, index) => {
      if (index === 0) {
        return q.where(...filter);
      }
      return q.andWhere(...filter);
    }, newQuery);

    let { tags } = filters;
    if (!tags && userId && !ignoreUserFilters) {
      // Fetch user tags
      tags = { include: (await feed.getUserTags(userId)).map(t => t.tag) };
    }

    if (tags) {
      if (nonEmptyArray(tags.include)) {
        const tagsQuery = db.select(db.raw('1'))
          .from(tagsTable)
          .where('tag', 'in', tags.include)
          .andWhere('post_id', '=', db.raw(`${table}.id`));
        newQuery = newQuery.whereExists(tagsQuery);
      }
      if (nonEmptyArray(tags.exclude)) {
        const tagsQuery = db.select(db.raw('1'))
          .from(tagsTable)
          .where('tag', 'in', tags.exclude)
          .andWhere('post_id', '=', db.raw(`${table}.id`));
        newQuery = newQuery.whereNotExists(tagsQuery);
      }
    }
  }
  // Workaround to return the query without invoking it
  return [newQuery];
};

/**
 * Generates a complete query for retrieving the requested feed
 * @param {?String[]} fields Fields to include in the response
 * @param {?Object} filters Object containing the filters to apply
 * @param {?Date} filters.before Retrieve posts which created before this time
 * @param {?Date} filters.after Retrieve posts which created after this time
 * @param {?String[]} filters.publications.include Retrieve posts from the list
 * @param {?String[]} filters.publications.exclude Retrieve posts which aren't from the list
 * @param {?String[]} filters.tags.include Retrieve posts with these tags
 * @param {?String[]} filters.tags.exclude Retrieve posts without these tags
 * @param {?String} filters.postId Retrieve a specific post by id
 * @param {?String[]} filters.postIds Retrieve a set of posts by id
 * @param {?Boolean} filters.bookmarks Whether to retrieve only bookmarked posts
 * @param {?String} filters.search Text query to filter posts
 * @param {?'popularity'|'creation'} rankBy Order criteria
 * @param {?String} userId Id of the user who requested the feed
 * @param {?Boolean} ignoreUserFilters Whether to ignore the user's preferences
 * @param {?Number} page Page number
 * @param {?Number} pageSize Number of posts per page
 * @param {?String} ip Request IP for search analytics
 * @param {?Function} hook Gets the query as a parameter and should return a new query
 * @returns Knex query object
 */
const generateFeed = async ({
                              fields, filters, rankBy, userId, ignoreUserFilters = false, page = 0, pageSize = 20, ip,
                            }, hook) => {
  let relevantFields = fields || Object.keys(singleFieldToQuery);
  if (relevantFields.indexOf('bookmarked') > -1 && !userId) {
    relevantFields = relevantFields.filter(f => f !== 'bookmarked');
  }

  const newFilters = filters;
  // fetch search results and then filter by their id
  if (newFilters.search) {
    const searchFilters = [];
    if (newFilters.before) {
      searchFilters.push(`createdAt < ${newFilters.before.getTime()}`);
    }
    if (newFilters.after) {
      searchFilters.push(`createdAt > ${newFilters.after.getTime()}`);
    }
    newFilters.postIds = (await searchPosts(filters.search, {
      filters: searchFilters.join(' AND '),
      page,
      hitsPerPage: pageSize,
    }, userId, ip)).map(p => p.id);
  }

  let query = db
    .select(...fieldsToSelect(relevantFields, userId))
    .from(table)
    .join('publications', `${table}.publication_id`, 'publications.id');

  // Join bookmarks table if needed
  if (userId && (relevantFields.indexOf('bookmarked') > -1 || (newFilters && newFilters.bookmarks))) {
    const args = [bookmarksTable, builder =>
      builder.on(`${bookmarksTable}.post_id`, '=', `${table}.id`)
        .andOn(`${bookmarksTable}.user_id`, '=', db.raw('?', [userId]))];
    if (newFilters && newFilters.bookmarks) {
      query = query.join(...args);
    } else {
      query = query.leftJoin(...args);
    }
  }

  [query] = await filtersToQuery(query, newFilters, rankBy, userId, ignoreUserFilters);

  if (!newFilters.search) {
    if (rankBy === 'popularity') {
      query = query.orderByRaw(`timestampdiff(minute, ${table}.created_at, current_timestamp()) - POW(LOG(${table}.views * 0.55 + 1), 2) * 60 ASC`);
    } else if (rankBy === 'creation') {
      query = query.orderBy(`${table}.created_at`, 'DESC');
    }
  }

  if (hook) {
    query = hook(query);
  }

  query = query.offset(page * pageSize).limit(pageSize);
  const posts = await query
    .map(toCamelCase)
    .map(mapPost(relevantFields));

  if (!newFilters.search) {
    return posts;
  }

  // sort by search ranking
  return posts.sort((a, b) => newFilters.postIds.indexOf(a.id) - newFilters.postIds.indexOf(b.id));
};

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

const setPostsAsTweeted = id =>
  db(table).where('id', '=', id).update({ tweeted: 1 });

const updateViews = async () => {
  const before = new Date();
  const res = await db.select('timestamp').from('config').where('key', '=', 'last_views_update');
  const after = res.length ? res[0].timestamp : new Date(0);

  await db.transaction(async (trx) => {
    await trx.raw('UPDATE posts p INNER JOIN (SELECT COUNT(DISTINCT user_id) count, post_id FROM events WHERE type = "view" AND timestamp >= ? AND timestamp < ? GROUP BY post_id) AS e ON p.id = e.post_id SET p.views = p.views + e.count', [after, before]);
    return trx.raw('INSERT INTO config (`key`, `timestamp`) VALUES (\'last_views_update\', ?) ON DUPLICATE KEY UPDATE timestamp = ?', [before, before]);
  });

  const updatedPosts = await db.raw('SELECT p.id objectID, p.views views FROM posts p INNER JOIN (SELECT post_id FROM events WHERE type = "view" AND timestamp >= ? AND timestamp < ? GROUP BY post_id) AS e ON p.id = e.post_id', [after, before]);
  const { index } = initAlgolia('posts');
  return index.partialUpdateObjects(updatedPosts[0]);
};

const bookmark = (bookmarks) => {
  const obj = bookmarks.map(b => toSnakeCase(Object.assign({ createdAt: new Date() }, b)));

  return db.insert(obj)
    .into(bookmarksTable).then(() => bookmarks);
};

const removeBookmark = (userId, postId) =>
  db(bookmarksTable).where(toSnakeCase({ userId, postId })).delete();

const hide = async (userId, postId) => {
  try {
    await db.insert(toSnakeCase({ userId, postId })).into(hideTable);
  } catch (err) {
    if (err.code !== 'ER_DUP_ENTRY') {
      throw err;
    }
  }
};

const get = async (id) => {
  const res = await generateFeed({
    fields: defaultAnonymousFields,
    filters: { postId: id },
  });
  return res.length ? res[0] : null;
};

const convertToAlgolia = obj =>
  renameKey(
    renameKey(
      renameKey(_.pick(obj, ['id', 'title', 'createdAt', 'views', 'readTime', 'publicationId', 'tags']), 'id', 'objectID'),
      'tags', '_tags',
    ),
    'publicationId', 'pubId',
  );

const addToAlgolia = (obj) => {
  const { index } = initAlgolia('posts');
  return index.addObject(convertToAlgolia(obj));
};

export default {
  add,
  setPostsAsTweeted,
  updateViews,
  bookmark,
  removeBookmark,
  defaultAnonymousFields,
  defaultUserFields,
  table,
  bookmarksTable,
  searchPosts,
  generateFeed,
  hide,
  get,
  addToAlgolia,
};
