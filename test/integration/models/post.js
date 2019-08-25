import { expect } from 'chai';
import knexCleaner from 'knex-cleaner';
import db, { migrate } from '../../../src/db';
import publication from '../../../src/models/publication';
import post from '../../../src/models/post';
import tag from '../../../src/models/tag';
import fixturePubs from '../../fixtures/publications';
import fixture from '../../fixtures/posts';

describe('post model', () => {
  beforeEach(async () => {
    await knexCleaner.clean(db, { ignoreTables: ['knex_migrations', 'knex_migrations_lock'] });
    await migrate();
    await Promise.all(fixturePubs.map(pub =>
      publication.add(pub.name, pub.image, pub.enabled, pub.twitter)));
  });

  it('should add new post to db', async () => {
    const input = fixture.input[0];
    const model = await post.add(input);

    expect(model).to.deep.equal(input);
  });

  it('should bookmark a given post', async () => {
    await Promise.all(fixture.input.map(p => post.add(p)));

    const models = await post.bookmark(fixture.bookmarks);
    expect(models).to.deep.equal(fixture.bookmarks);
  });

  it('should remove bookmark', async () => {
    await Promise.all(fixture.input.map(p => post.add(p)));
    await tag.updateTagsCount();

    await post.bookmark(fixture.bookmarks);
    await post.removeBookmark(fixture.bookmarks[0].userId, fixture.bookmarks[0].postId);
  });
});
