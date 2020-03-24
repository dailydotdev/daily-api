exports.up = knex =>
  knex.schema.table('settings', (table) => {
    table.boolean('show_only_not_read_posts').defaultTo(false);
  });

exports.down = knex =>
  knex.schema.table('settings', (table) => {
    table.dropColumn('show_only_not_read_posts');
  });
