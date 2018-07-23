exports.up = knex =>
  knex.schema.createTable('providers', (table) => {
    table.string('user_id').notNullable();
    table.string('provider').notNullable();
    table.string('provider_id').notNullable();
    table.string('access_token').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('expires_in').nullable();
    table.string('refresh_token').nullable();

    table.unique(['user_id', 'provider']);
    table.unique(['provider_id', 'provider']);
  });

exports.down = knex => knex.schema.dropTableIfExists('providers');
