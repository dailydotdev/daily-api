import db, { toCamelCase, toSnakeCase } from '../db';

const table = 'pubs_requests';

const mapNullableBool = x => (x === null ? x : !!x);

const mapPubRequest = x =>
  Object.assign({}, toCamelCase(x), { approved: mapNullableBool(x.approved), closed: !!x.closed });

/**
 * Add new publication request
 * @param obj - The request to add.
 * @param {String} obj.url
 * @param {String} obj.userId
 * @param {String} [obj.userName]
 * @param {String} [obj.userEmail]
 */
const add = obj => db(table).insert(toSnakeCase(obj));

/**
 * Update an existing publication request
 * @param {Number} id - Request id to update
 * @param obj - The information to update.
 * @param {String} [obj.url]
 * @param {Boolean} [obj.approved]
 * @param {String} [obj.reason]
 * @param {String} [obj.pubId]
 * @param {String} [obj.pubName]
 * @param {String} [obj.pubImage]
 * @param {String} [obj.pubTwitter]
 * @param {String} [obj.pubRss]
 * @param {Boolean} [obj.closed]
 */
const update = (id, obj) => db(table).where('id', '=', id).update(toSnakeCase(obj));

const getById = id =>
  db.select()
    .from(table)
    .where('id', '=', id)
    .limit(1)
    .map(mapPubRequest)
    .then(res => (res.length ? res[0] : null));

const getOpenRequests = () =>
  db.select()
    .from(table)
    .where('closed', '=', false)
    .orderBy('created_at')
    .map(mapPubRequest);

export default {
  add,
  update,
  getById,
  getOpenRequests,
};
