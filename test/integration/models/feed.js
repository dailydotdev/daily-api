import { expect } from 'chai';
import knexCleaner from 'knex-cleaner';
import db, { migrate } from '../../../src/db';
import feed from '../../../src/models/feed';
import fixturePubs from '../../fixtures/publications';
import fixture from '../../fixtures/feeds';
import publication from '../../../src/models/publication';

describe('feed model', () => {
  beforeEach(async () => {
    await knexCleaner.clean(db, { ignoreTables: ['knex_migrations', 'knex_migrations_lock'] });
    await migrate();
    return Promise.all(fixturePubs.map(pub =>
      publication.add(pub.name, pub.image, pub.enabled, pub.twitter)));
  });

  it('should add new publication to feed', async () => {
    const model = await feed.upsert([fixture[0]]);
    expect(model).to.deep.equal([fixture[0]]);
  });

  it('should fetch all publications in feed', async () => {
    await feed.upsert(fixture);

    const model = await feed.getByUserId(fixture[0].userId);
    expect(model).to.deep.equal([fixture[0], fixture[1], fixture[4]]);
  });
});
