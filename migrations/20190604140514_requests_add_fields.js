exports.up = knex =>
  knex.schema.table('pubs_requests', (table) => {
    table.string('pub_id').nullable();
    table.string('pub_name').nullable();
    table.string('pub_image').nullable();
    table.string('pub_twitter').nullable();
    table.string('pub_rss').nullable();
    table.boolean('published').defaultTo(0);
  });

exports.down = knex =>
  knex.schema.table('pubs_requests', (table) => {
    table.dropColumn('pub_id');
    table.dropColumn('pub_name');
    table.dropColumn('pub_image');
    table.dropColumn('pub_twitter');
    table.dropColumn('pub_rss');
    table.dropColumn('published');
  });
