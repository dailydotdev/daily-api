
exports.up = knex =>
  knex.schema.createTable('settings', (table) => {
    table.string('user_id').primary();
    table.string('theme');
    table.boolean('enable_card_animations');
    table.boolean('show_top_sites');
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

exports.down = knex => knex.schema.dropTableIfExists('settings');
