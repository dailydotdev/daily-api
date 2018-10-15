exports.up = knex =>
  knex.transaction(trx =>
    trx.raw('delete e1 from events as e1 ' +
      'join events as e2 on e1.type = e2.type and e1.user_id = e2.user_id and e1.post_id = e2.post_id ' +
      'where e1.timestamp < e2.timestamp')
      .then(() =>
        trx.schema.table('events', (table) => {
          table.unique(['type', 'user_id', 'post_id']);
        })));

exports.down = () => Promise.resolve();
