exports.up = knex =>
  knex.schema.createTable('tags', (table) => {
    table.string('post_id').notNullable();
    table.string('tag').notNullable();

    table.unique(['post_id', 'tag']);
  });

exports.down = knex => knex.schema.dropTableIfExists('tags');
