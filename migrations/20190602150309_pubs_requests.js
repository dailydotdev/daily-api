// eslint-disable-next-line arrow-body-style
exports.up = async knex =>
  knex.schema.createTable('pubs_requests', (table) => {
    table.increments('id').primary().unsigned();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.string('url').notNullable();
    table.string('user_id').notNullable();
    table.string('user_name').nullable();
    table.string('user_email').nullable();
    table.boolean('approved').nullable();
    table.string('reason').nullable();

    table.index('created_at');
    table.index('url');
    table.index('user_id');
    table.index('approved');
  });

// eslint-disable-next-line arrow-body-style
exports.down = async knex =>
  knex.schema.dropTableIfExists('pubs_requests');
