exports.up = knex =>
  knex.schema.createTable('notifications', (table) => {
    table.timestamp('timestamp').defaultTo(knex.fn.now()).primary();
    table.string('html').notNullable();
  });

exports.down = knex => knex.schema.dropTableIfExists('notifications');
