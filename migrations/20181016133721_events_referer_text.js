exports.up = knex =>
  knex.schema.table('events', (table) => {
    table.text('referer').alter();
  });

exports.down = () => Promise.resolve();
