exports.up = knex =>
  knex.schema.createTable('user_tags', (table) => {
    table.string('user_id').notNullable();
    table.string('tag').notNullable();

    table.unique(['user_id', 'tag']);
  });

exports.down = knex => knex.schema.dropTableIfExists('user_tags');
