exports.up = knex =>
  knex.schema.table('notifications', (table) => {
    table.text('html').notNullable().alter();
  });

exports.down = () => Promise.resolve();
