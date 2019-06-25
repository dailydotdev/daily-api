const pubs = require('../data/pubs.json');
const posts = require('../data/posts.json');
const tags = require('../data/tags.json');
const tagsCount = require('../data/tags_count.json');

const randomTime = (epochFrom, epochTo) =>
  new Date(Math.floor((Math.random() * (epochTo - epochFrom)) + epochFrom));

const now = Date.now();
const oneMonthBefore = now - (1000 * 60 * 60 * 24 * 30);

exports.seed = async (knex) => {
  await knex('publications').insert(pubs);
  await knex('posts').insert(posts.map(p =>
    Object.assign({}, p, { created_at: randomTime(oneMonthBefore, now) })));
  await knex('tags').insert(tags);
  await knex('tags_count').insert(tagsCount);
};

