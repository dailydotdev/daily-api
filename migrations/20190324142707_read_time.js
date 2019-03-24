exports.up = knex =>
  knex.schema.table('posts', (table) => {
    table.integer('read_time').nullable().defaultTo(null);
  });

exports.down = knex =>
  knex.schema.table('posts', (table) => {
    table.dropColumn('read_time');
  });
