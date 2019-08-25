import { expect } from 'chai';
import knexCleaner from 'knex-cleaner';
import db, { migrate } from '../../../src/db';
import publication from '../../../src/models/publication';
import post from '../../../src/models/post';
import tag from '../../../src/models/tag';
import feed from '../../../src/models/feed';
import fixturePubs from '../../fixtures/publications';
import fixture from '../../fixtures/posts';
import fixtureToilet from '../../fixtures/toilet';

describe('post model', () => {
  const latestDate = new Date(fixture.input[1].createdAt.getTime() + 1000);

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

  it('should fetch all posts sorted by score', async () => {
    await Promise.all(fixture.input.map(p => post.add(p)));
    await tag.updateTagsCount();

    const models = await post.getLatest(latestDate, 0, 20);
    expect(models).to.deep.equal(fixture.output);
  });

  it('should fetch posts by tags sorted by score', async () => {
    await Promise.all(fixture.input.map(p => post.add(p)));
    await tag.updateTagsCount();

    const models = await post.getLatest(latestDate, 0, 20, null, ['a']);
    expect(models).to.deep.equal(fixture.output);
  });

  it('should fetch posts by pages sorted by score', async () => {
    await Promise.all(fixture.input.map(p => post.add(p)));
    await tag.updateTagsCount();

    const page1 = await post.getLatest(latestDate, 0, 1);
    expect(page1).to.deep.equal([fixture.output[0]]);

    const page2 = await post.getLatest(latestDate, 1, 1);
    expect(page2).to.deep.equal([fixture.output[1]]);
  });

  it('should fetch posts only from given publications', async () => {
    await Promise.all(fixture.input.map(p => post.add(p)));
    await tag.updateTagsCount();

    const models =
      await post.getLatest(latestDate, 0, 20, [fixture.input[1].publicationId]);
    expect(models).to.deep.equal([fixture.output[0]]);
  });

  it('should fetch post by id', async () => {
    await Promise.all(fixture.input.map(p => post.add(p)));
    await tag.updateTagsCount();

    const model = await post.get(fixture.output[0].id);
    expect(model).to.deep.equal(fixture.output[0]);
  });

  it('should return null when no such post', async () => {
    const model = await post.get('123124');
    expect(model).to.equal(null);
  });

  it('should return a post to tweet', async () => {
    const views = [1000, 0];
    await Promise.all(fixture.input.map((p, index) =>
      post.add(Object.assign({}, p, { views: views[index] }))));

    const model = await post.getPostToTweet();
    expect(model).to.deep.equal({
      id: fixture.input[0].id,
      title: fixture.input[0].title,
      image: fixture.input[0].image,
      placeholder: fixture.input[0].placeholder,
      ratio: fixture.input[0].ratio,
      twitter: fixturePubs[0].twitter,
      siteTwitter: null,
      creatorTwitter: null,
    });
  });

  it('should set the post as tweeted', async () => {
    await Promise.all(fixture.input.map(p => post.add(p)));

    await post.setPostsAsTweeted(fixture.input[0].id);

    const model = await post.getPostToTweet();
    expect(model).to.equal(null);
  });

  it('should bookmark a given post', async () => {
    await Promise.all(fixture.input.map(p => post.add(p)));

    const models = await post.bookmark(fixture.bookmarks);
    expect(models).to.deep.equal(fixture.bookmarks);
  });

  it('should get bookmarks', async () => {
    await Promise.all(fixture.input.map(p => post.add(p)));
    await tag.updateTagsCount();

    await post.bookmark(fixture.bookmarks);

    const latest = new Date(Date.now() + (60 * 60 * 1000));

    const page1 = await post.getBookmarks(latest, 0, 20, fixture.bookmarks[0].userId);
    expect(page1).to.have.deep.members([fixture.output[0], fixture.output[1]]);
  });

  it('should remove bookmark', async () => {
    await Promise.all(fixture.input.map(p => post.add(p)));
    await tag.updateTagsCount();

    await post.bookmark(fixture.bookmarks);
    await post.removeBookmark(fixture.bookmarks[0].userId, fixture.bookmarks[0].postId);

    const latest = new Date(Date.now() + (60 * 60 * 1000));

    const page1 = await post.getBookmarks(latest, 0, 2, fixture.bookmarks[0].userId);
    expect(page1).to.deep.equal([fixture.output[1]]);
  });

  it('should get users latest', async () => {
    await Promise.all(fixture.input.map(p => post.add(p)));
    await tag.updateTagsCount();

    await post.bookmark([{ userId: 'user1', postId: fixture.input[0].id }]);
    await feed.upsertUserPublications([{
      userId: 'user1',
      publicationId: fixture.input[1].publicationId,
      enabled: false,
    }]);

    const models = await post.getUserLatest(fixture.input[1].createdAt, 0, 20, 'user1');
    expect(models).to.deep.equal([Object.assign({ bookmarked: true }, fixture.output[1])]);
  });

  it('should get post tags', async () => {
    const input = fixture.input[0];
    await post.add(input);
    const tags = await post.getPostTags(input.id);

    expect(tags).to.deep.equal(input.tags);
  });

  it('should get toilet posts', async () => {
    await Promise.all(fixtureToilet.input.map(p => post.add(p)));
    await tag.updateTagsCount();
    await post.bookmark(fixtureToilet.bookmarks);

    const latest = new Date(Date.now() + (60 * 60 * 1000));

    const models = await post.getToilet(latest, 0, 8, 'user1');
    expect(models).to.deep.equal(fixtureToilet.output);
  });

  it('should fetch all posts by publications sorted by time', async () => {
    await Promise.all(fixture.input.map(p => post.add(p)));
    await tag.updateTagsCount();

    const models = await post.getByPublication(
      latestDate,
      0,
      20,
      fixture.input[1].publicationId,
    );
    expect(models).to.deep.equal(fixture.pubsOutput);
  });

  it('should fetch all posts by tag sorted by time', async () => {
    await Promise.all(fixture.input.map(p => post.add(p)));
    await tag.updateTagsCount();

    const models = await post.getByTag(latestDate, 0, 20, 'a');
    expect(models).to.deep.equal(fixture.tagsOutput);
  });
});
