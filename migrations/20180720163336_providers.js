exports.up = knex =>
  knex.schema.createTable('providers', (table) => {
    table.string('user_id').notNullable();
    table.string('provider').notNullable();
    table.string('access_token').notNullable();

    table.unique(['user_id', 'provider']);
  });

exports.down = knex => knex.schema.dropTableIfExists('providers');
