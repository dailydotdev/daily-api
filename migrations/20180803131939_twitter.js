exports.up = knex =>
  knex.schema.table('posts', (table) => {
    table.string('site_twitter').nullable();
    table.string('creator_twitter').nullable();
  });

exports.down = knex =>
  knex.schema.table('posts', (table) => {
    table.dropColumn('site_twitter');
    table.dropColumn('creator_twitter');
  });
