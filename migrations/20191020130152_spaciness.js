exports.up = knex =>
  knex.schema.table('settings', (table) => {
    table.string('spaciness').defaultTo('eco');
  });

exports.down = knex =>
  knex.schema.table('settings', (table) => {
    table.dropColumn('spaciness');
  });
