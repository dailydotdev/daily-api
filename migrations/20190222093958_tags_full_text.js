exports.up = knex =>
  knex.raw('alter table `tags_count` add fulltext key tags_count_tag (`tag`)');

exports.down = () => Promise.resolve();
