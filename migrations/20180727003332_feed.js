// eslint-disable-next-line arrow-body-style
exports.up = async (knex) => {
  await knex.schema.createTable('bookmarks', (table) => {
    table.string('user_id').notNullable();
    table.string('post_id').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.foreign('post_id').references('posts.id');
    table.unique(['user_id', 'post_id']);
    table.index('user_id');
  });

  return knex.schema.createTable('feeds', (table) => {
    table.string('user_id').notNullable();
    table.string('publication_id').notNullable();
    table.boolean('enabled').notNullable();

    table.foreign('publication_id').references('publications.id');
    table.unique(['user_id', 'publication_id']);
    table.index(['user_id', 'enabled']);
  });
};

// eslint-disable-next-line arrow-body-style
exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('bookmarks');
  return knex.schema.dropTableIfExists('feeds');
};
