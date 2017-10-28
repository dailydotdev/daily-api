import { expect } from 'chai';
import { createTables, dropTables } from '../../../src/db';
import publication from '../../../src/models/publication';
import post from '../../../src/models/post';
import fixturePubs from '../../fixtures/publications';
import fixture from '../../fixtures/posts';

describe('post model', () => {
  beforeEach(async () => {
    await dropTables();
    await createTables();
    await Promise.all(fixturePubs.map(pub => publication.add(pub.name, pub.image)));
  });

  it('should add new post to db', async () => {
    const input = fixture.input[0];
    const model = await post.add(
      input.id, input.title, input.url,
      input.publicationId, input.publishedAt, input.createdAt, input.image,
    );
    expect(model).to.deep.equal(input);
  });

  it('should fetch all posts sorted by time', async () => {
    await Promise.all(fixture.input.map(p =>
      post.add(p.id, p.title, p.url, p.publicationId, p.publishedAt, p.createdAt, p.image)));
    const models = await post.getLatest(fixture.input[1].publishedAt, 0, 20);
    expect(models).to.deep.equal(fixture.output);
  });

  it('should fetch posts by pages sorted by time', async () => {
    await Promise.all(fixture.input.map(p =>
      post.add(p.id, p.title, p.url, p.publicationId, p.publishedAt, p.createdAt, p.image)));

    const page1 = await post.getLatest(fixture.input[1].publishedAt, 0, 1);
    expect(page1).to.deep.equal([fixture.output[0]]);

    const page2 = await post.getLatest(fixture.input[1].publishedAt, 1, 1);
    expect(page2).to.deep.equal([fixture.output[1]]);
  });

  it('should fetch post by id', async () => {
    await Promise.all(fixture.input.map(p =>
      post.add(p.id, p.title, p.url, p.publicationId, p.publishedAt, p.createdAt, p.image)));

    const model = await post.get(fixture.output[0].id);
    expect(model).to.deep.equal(fixture.output[0]);
  });

  it('should return null when no such post', async () => {
    const model = await post.get('123124');
    expect(model).to.equal(null);
  });
});
