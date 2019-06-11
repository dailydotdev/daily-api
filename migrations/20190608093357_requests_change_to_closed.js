exports.up = knex =>
  knex.schema.table('pubs_requests', (table) => {
    table.boolean('closed').defaultTo(0);
    table.dropColumn('published');
    table.index('closed');
  });

exports.down = knex =>
  knex.schema.table('pubs_requests', (table) => {
    table.dropIndex('closed');
    table.boolean('published').defaultTo(0);
    table.dropColumn('closed');
  });
