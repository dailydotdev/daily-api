exports.up = knex =>
  knex.schema.table('posts', (table) => {
    table.string('url', 510).notNullable().alter();
    table.string('image', 510).alter();
  });

exports.down = () => Promise.resolve();
