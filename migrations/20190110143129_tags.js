const createView = (knex, viewDefinition, name) =>
  knex.schema.raw(`create or replace view ${name} as (\n${viewDefinition}\n)`);

exports.up = knex =>
  knex.schema.table('tags', (table) => {
    table.index('post_id');
    table.index('tag');
  }).then(() => knex.schema.createTable('tags_count', (table) => {
    table.string('tag').primary();
    table.integer('count').notNullable();

    table.index('count');
  })).then(() => {
    // eslint-disable-next-line global-require
    const tag = require('../src/models/tag');
    return tag.default.updateTagsCount();
  }).then(() => createView(
    knex,
    knex.select('tags.post_id', knex.raw('group_concat(tags.tag order by tags_count.count desc separator \',\') as tags'))
      .from('tags')
      .join('tags_count', 'tags.tag', 'tags_count.tag')
      .groupBy('post_id'),
    'tags_concat_view',
  ));

exports.down = knex =>
  knex.schema.table('tags', (table) => {
    table.dropIndex('post_id');
    table.dropIndex('tag');
  }).then(() => knex.schema.dropTableIfExists('tags_count'))
    .then(() => knex.schema.raw('drop view tags_concat_view'));
