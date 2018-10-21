exports.up = knex =>
  knex.schema.table('events', (table) => {
    table.text('agent').alter();
  });

exports.down = () => Promise.resolve();
