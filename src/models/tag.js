import db, { toSnakeCase } from '../db';

const table = 'tags_count';
const postsTable = 'posts';
const tagsTable = 'tags';

const getPopular = () =>
  db.from(table)
    .select('tag as name')
    .orderBy('count', 'desc')
    .where('count', '>=', 50)
    .limit(50);

const updateTagsCount = async () =>
  db.transaction(async (trx) => {
    await trx(table).truncate();
    return trx.from(table).insert(trx
      .select(`${tagsTable}.tag`, trx.raw('count(*) as count'))
      .from(tagsTable)
      .join(postsTable, `${tagsTable}.post_id`, `${postsTable}.id`)
      .whereRaw(`datediff(now(), ${postsTable}.created_at) < 30`)
      .groupBy(`${tagsTable}.tag`));
  });

const addPostTags = (tags, trx = db) =>
  trx.insert(tags.map(toSnakeCase)).into(tagsTable);

const search = query =>
  getPopular()
    .andWhereRaw('MATCH (tag) AGAINST (\'??\' IN BOOLEAN MODE)', [`*${query}*`]);

export default {
  getPopular,
  updateTagsCount,
  addPostTags,
  search,
};
