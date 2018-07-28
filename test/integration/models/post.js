import { expect } from 'chai';
import knexCleaner from 'knex-cleaner';
import db, { migrate } from '../../../src/db';
import publication from '../../../src/models/publication';
import post from '../../../src/models/post';
import feed from '../../../src/models/feed';
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
    const input = Object.assign({}, fixture.input[0]);
    const model = await post.add(
      input.id, input.title, input.url, input.publicationId, input.publishedAt,
      input.createdAt, input.image, input.ratio, input.placeholder, input.promoted,
    );

    delete input.tags;
    expect(model).to.deep.equal(input);
  });

  it('should fetch all posts sorted by time', async () => {
    await Promise.all(fixture.input.map(p =>
      post.add(
        p.id, p.title, p.url, p.publicationId, p.publishedAt, p.createdAt,
        p.image, p.ratio, p.placeholder, p.promoted,
      )));

    const models = await post.getLatest(fixture.input[1].createdAt, 0, 20);
    expect(models).to.deep.equal(fixture.output);
  });

  it('should fetch posts by pages sorted by time', async () => {
    await Promise.all(fixture.input.map(p =>
      post.add(
        p.id, p.title, p.url, p.publicationId, p.publishedAt, p.createdAt,
        p.image, p.ratio, p.placeholder, p.promoted,
      )));

    const page1 = await post.getLatest(fixture.input[1].createdAt, 0, 1);
    expect(page1).to.deep.equal([fixture.output[0]]);

    const page2 = await post.getLatest(fixture.input[1].createdAt, 1, 1);
    expect(page2).to.deep.equal([fixture.output[1]]);
  });

  it('should fetch posts only from given publications', async () => {
    await Promise.all(fixture.input.map(p =>
      post.add(
        p.id, p.title, p.url, p.publicationId, p.publishedAt, p.createdAt,
        p.image, p.ratio, p.placeholder, p.promoted,
      )));

    const models =
      await post.getLatest(fixture.input[1].createdAt, 0, 20, [fixture.input[1].publicationId]);
    expect(models).to.deep.equal([fixture.output[0]]);
  });

  it('should fetch all promoted posts', async () => {
    await Promise.all(fixture.input.map(p =>
      post.add(
        p.id, p.title, p.url, p.publicationId, p.publishedAt, p.createdAt,
        p.image, p.ratio, p.placeholder, p.promoted,
      )));

    const models = await post.getPromoted();
    expect(models).to.deep.equal(fixture.promotedOutput);
  });

  it('should fetch post by id', async () => {
    await Promise.all(fixture.input.map(p =>
      post.add(
        p.id, p.title, p.url, p.publicationId, p.publishedAt, p.createdAt,
        p.image, p.ratio, p.placeholder, p.promoted,
      )));

    const model = await post.get(fixture.output[0].id);
    expect(model).to.deep.equal(fixture.output[0]);
  });

  it('should return null when no such post', async () => {
    const model = await post.get('123124');
    expect(model).to.equal(null);
  });

  it('should return a post to tweet', async () => {
    const views = [40, 0];
    await Promise.all(fixture.input.map((p, index) =>
      post.add(
        p.id, p.title, p.url, p.publicationId, p.publishedAt, p.createdAt,
        p.image, p.ratio, p.placeholder, p.promoted, views[index],
      )));

    const model = await post.getPostToTweet();
    expect(model).to.deep.equal({
      id: fixture.input[0].id,
      title: fixture.input[0].title,
      image: fixture.input[0].image,
      twitter: fixturePubs[0].twitter,
    });
  });

  it('should set the post as tweeted', async () => {
    await Promise.all(fixture.input.map(p =>
      post.add(
        p.id, p.title, p.url, p.publicationId, p.publishedAt, p.createdAt,
        p.image, p.ratio, p.placeholder, p.promoted, p.views,
      )));

    await post.setPostsAsTweeted(fixture.input[0].id);

    const model = await post.getPostToTweet();
    expect(model).to.equal(null);
  });

  it('should add tags to new post', async () => {
    const input = Object.assign({}, fixture.input[0]);
    const model = await post.add(
      input.id, input.title, input.url, input.publicationId, input.publishedAt,
      input.createdAt, input.image, input.ratio, input.placeholder, input.promoted, 0, input.tags,
    );

    delete input.tags;
    expect(model).to.deep.equal(input);
  });

  it('should bookmark a given post', async () => {
    await Promise.all(fixture.input.map(p =>
      post.add(
        p.id, p.title, p.url, p.publicationId, p.publishedAt, p.createdAt,
        p.image, p.ratio, p.placeholder, p.promoted, p.views,
      )));

    const models = await post.bookmark(fixture.bookmarks);
    expect(models).to.deep.equal(fixture.bookmarks);
  });

  it('should get bookmarks sorted by time', async () => {
    await Promise.all(fixture.input.map(p =>
      post.add(
        p.id, p.title, p.url, p.publicationId, p.publishedAt, p.createdAt,
        p.image, p.ratio, p.placeholder, p.promoted, p.views,
      )));

    await post.bookmark(fixture.bookmarks);

    const latest = new Date(Date.now() + (60 * 60 * 1000));

    const page1 = await post.getBookmarks(latest, 0, 1, fixture.bookmarks[0].userId);
    expect(page1).to.deep.equal([fixture.output[1]]);

    const page2 = await post.getBookmarks(latest, 1, 1, fixture.bookmarks[0].userId);
    expect(page2).to.deep.equal([fixture.output[0]]);
  });

  it('should remove bookmark', async () => {
    await Promise.all(fixture.input.map(p =>
      post.add(
        p.id, p.title, p.url, p.publicationId, p.publishedAt, p.createdAt,
        p.image, p.ratio, p.placeholder, p.promoted, p.views,
      )));

    await post.bookmark(fixture.bookmarks);
    await post.removeBookmark(fixture.bookmarks[0].userId, fixture.bookmarks[0].postId);

    const latest = new Date(Date.now() + (60 * 60 * 1000));

    const page1 = await post.getBookmarks(latest, 0, 2, fixture.bookmarks[0].userId);
    expect(page1).to.deep.equal([fixture.output[1]]);
  });

  it('should get users latest', async () => {
    await Promise.all(fixture.input.map(p =>
      post.add(
        p.id, p.title, p.url, p.publicationId, p.publishedAt, p.createdAt,
        p.image, p.ratio, p.placeholder, p.promoted, p.views,
      )));

    await post.bookmark([{ userId: 'user1', postId: fixture.input[0].id }]);
    await feed.upsert([{ userId: 'user1', publicationId: fixture.input[1].publicationId, enabled: false }]);

    const latest = new Date(Date.now() + (60 * 60 * 1000));

    const models = await post.getUserLatest(latest, 0, 20, 'user1');
    expect(models).to.deep.equal([Object.assign({ bookmarked: true }, fixture.output[1])]);
  });
});
