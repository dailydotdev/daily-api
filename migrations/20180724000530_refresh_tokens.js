
exports.up = knex =>
  knex.schema.createTable('refresh_tokens', (table) => {
    table.string('token').primary();
    table.string('user_id').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

exports.down = knex => knex.schema.dropTableIfExists('refresh_tokens');
