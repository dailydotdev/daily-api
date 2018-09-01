exports.up = knex =>
  knex.schema.table('settings', (table) => {
    table.boolean('enable_card_animations').defaultTo(1).alter();
    table.boolean('show_top_sites').defaultTo(1).alter();
    table.boolean('app_insane_mode').defaultTo(1);
  });

exports.down = knex =>
  knex.schema.table('settings', (table) => {
    table.dropColumn('app_insane_mode');
  });
