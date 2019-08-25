import { expect } from 'chai';
import knexCleaner from 'knex-cleaner';
import _ from 'lodash';
import db, { migrate } from '../../../src/db';
import publication from '../../../src/models/publication';
import post from '../../../src/models/post';
import tag from '../../../src/models/tag';
import feed from '../../../src/models/feed';
import fixturePubs from '../../fixtures/publications';
import fixture from '../../fixtures/posts';
import feedFixture from '../../fixtures/feedGenerator';

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

  describe('feed generation', () => {
    beforeEach(async () => {
      await knexCleaner.clean(db, { ignoreTables: ['knex_migrations', 'knex_migrations_lock'] });
      await migrate();
      await Promise.all(feedFixture.pubs.map(pub =>
        publication.add(pub.name, pub.image, pub.enabled, pub.twitter, pub.id)));
      await Promise.all(feedFixture.posts.map(p => post.add(p)));
      await tag.updateTagsCount();
    });

    it('should return all posts ordered by time', async () => {
      const actual = await post.generateFeed({ fields: ['id'], rankBy: 'creation' });
      expect(actual).to.deep.equal(feedFixture.posts.map(p => ({ id: p.id })));
    });

    it('should return posts by pages', async () => {
      const page1 = await post.generateFeed({
        fields: ['id'], rankBy: 'creation', pageSize: 5,
      });
      expect(page1).to.deep.equal(feedFixture.posts.slice(0, 5).map(p => ({ id: p.id })));
      const page2 = await post.generateFeed({
        fields: ['id'], rankBy: 'creation', pageSize: 5, page: 1,
      });
      expect(page2).to.deep.equal(feedFixture.posts.slice(5, 10).map(p => ({ id: p.id })));
    });

    it('should return posts with publication field', async () => {
      const actual = await post.generateFeed({ fields: ['id', 'publication'], rankBy: 'creation' });
      expect(actual).to.deep.equal(feedFixture.posts.map((p) => {
        const pub = feedFixture.pubs.filter(x => x.id === p.publicationId)[0];
        return { id: p.id, publication: _.pick(pub, ['id', 'name', 'image']) };
      }));
    });

    it('should return posts with tags field', async () => {
      const actual = await post.generateFeed({ fields: ['tags'], rankBy: 'creation' });
      for (let i = 0; i < actual.length; i += 1) {
        expect(actual[i].tags).to.have.deep.members(feedFixture.posts[i].tags);
      }
    });

    it('should return posts with bookmarked field', async () => {
      await post.bookmark([
        { userId: '1', postId: feedFixture.posts[0].id },
        { userId: '1', postId: feedFixture.posts[2].id },
        { userId: '2', postId: feedFixture.posts[1].id },
      ]);

      const expected = feedFixture.posts.map(p => ({ id: p.id, bookmarked: false }));
      expected[0].bookmarked = true;
      expected[2].bookmarked = true;

      const actual = await post.generateFeed({ fields: ['id', 'bookmarked'], rankBy: 'creation', userId: '1' });
      expect(actual).to.deep.equal(expected);
    });

    it('should return posts within the given time', async () => {
      const actual = await post.generateFeed({
        fields: ['id'],
        rankBy: 'creation',
        filters: { before: feedFixture.posts[1].createdAt, after: feedFixture.posts[5].createdAt },
      });
      expect(actual).to.deep.equal(feedFixture.posts.slice(2, 5).map(p => ({ id: p.id })));
    });

    it('should return posts of the specific publications', async () => {
      const actual = await post.generateFeed({
        fields: ['id'],
        rankBy: 'creation',
        filters: { publications: { include: ['itnext', 'medium_js'] } },
      });
      expect(actual).to.deep.equal([feedFixture.posts[0], feedFixture.posts[2]]
        .map(p => ({ id: p.id })));
    });

    it('should return posts not from the specific publications', async () => {
      const actual = await post.generateFeed({
        fields: ['id'],
        rankBy: 'creation',
        filters: { publications: { exclude: ['itnext', 'medium_js'] } },
      });
      expect(actual).to.deep.equal(feedFixture.posts
        .filter(p => ['itnext', 'medium_js'].indexOf(p.publicationId) === -1)
        .map(p => ({ id: p.id })));
    });

    it('should return posts with specific tags preferences', async () => {
      const actual = await post.generateFeed({
        fields: ['id'],
        rankBy: 'creation',
        filters: { tags: { include: ['javascript', 'webdev', 'react'], exclude: ['nodejs', 'deployment'] } },
      });
      expect(actual).to.deep.equal([feedFixture.posts[1], feedFixture.posts[3]]
        .map(p => ({ id: p.id })));
    });

    it('should return post by id', async () => {
      const actual = await post.generateFeed({
        fields: ['id'],
        rankBy: 'creation',
        filters: { postId: feedFixture.posts[0].id },
      });
      expect(actual).to.deep.equal([feedFixture.posts[0]]
        .map(p => ({ id: p.id })));
    });

    it('should return only bookmarks', async () => {
      await post.bookmark([
        { userId: '1', postId: feedFixture.posts[0].id },
        { userId: '1', postId: feedFixture.posts[1].id },
        { userId: '2', postId: feedFixture.posts[2].id },
      ]);

      const actual = await post.generateFeed({
        fields: ['id'],
        rankBy: 'creation',
        userId: '1',
        filters: { bookmarks: true },
      });
      expect(actual).to.deep.equal(feedFixture.posts.slice(0, 2).map(p => ({ id: p.id })));
    });

    it('should return posts by user preferences', async () => {
      await feed.addUserTags([
        { userId: '1', tag: 'javascript' },
        { userId: '1', tag: 'webdev' },
        { userId: '1', tag: 'react' },
      ]);
      await feed.upsertUserPublications([
        { userId: '1', publicationId: 'itnext', enabled: false },
        { userId: '1', publicationId: 'medium_js', enabled: false },
      ]);

      const actual = await post.generateFeed({
        fields: ['id'],
        rankBy: 'creation',
        userId: '1',
      });
      expect(actual).to.deep.equal([feedFixture.posts[1], feedFixture.posts[3]]
        .map(p => ({ id: p.id })));
    });
  });
});
