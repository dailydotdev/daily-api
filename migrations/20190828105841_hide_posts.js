exports.up = knex =>
  knex.schema.createTable('hidden_posts', (table) => {
    table.string('user_id').notNullable();
    table.string('post_id').notNullable();

    table.primary(['post_id', 'user_id']);
    table.index('user_id');
    table.index('post_id');
  });

exports.down = knex =>
  knex.schema.dropTableIfExists('hidden_posts');
