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
    const model = await feed.upsertUserPublications([fixture[0]]);
    expect(model).to.deep.equal([fixture[0]]);
  });

  it('should fetch all publications in feed', async () => {
    await feed.upsertUserPublications(fixture);

    const model = await feed.getUserPublications(fixture[0].userId);
    expect(model).to.deep.equal([fixture[0], fixture[1], fixture[4]]);
  });

  it('should add new user tags', async () => {
    const tags = [{ tag: 'javascript', userId: 'user1' }];
    const model = await feed.addUserTags(tags);
    expect(model).to.deep.equal(tags);
  });

  it('should fetch all publications in feed', async () => {
    const tags = [{ tag: 'golang', userId: 'user1' }, { tag: 'javascript', userId: 'user1' }];
    await feed.addUserTags(tags);

    const model = await feed.getUserTags('user1');
    expect(model).to.deep.equal(tags);
  });

  it('should fetch all publications in feed', async () => {
    const tags = [{ tag: 'golang', userId: 'user1' }, { tag: 'javascript', userId: 'user1' }];
    await feed.addUserTags(tags);
    await feed.removeUserTags('golang', 'user1');
    const model = await feed.getUserTags('user1');
    expect(model).to.deep.equal([tags[1]]);
  });
});
