exports.up = knex =>
  knex.schema.table('settings', (table) => {
    table.boolean('insane_mode').defaultTo(0);
  });

exports.down = knex =>
  knex.schema.table('settings', (table) => {
    table.dropColumn('insane_mode');
  });
