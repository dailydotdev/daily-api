exports.up = knex =>
  knex.schema.table('settings', (table) => {
    table.string('theme').defaultTo('darcula').alter();
  });

exports.down = () => Promise.resolve();
