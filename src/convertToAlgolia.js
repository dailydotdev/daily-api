/* eslint-disable */

const fs = require('fs').promises;
const _ = require('lodash');
const posts = require(process.argv[2]);
const converted = posts.map(p => _.assign(p, {
  _tags: p._tags && p._tags.split(','),
  createdAt: (new Date(p.createdAt)).getTime(),
}));
fs.writeFile(process.argv[3], JSON.stringify(converted))
  .then(() => process.exit());
