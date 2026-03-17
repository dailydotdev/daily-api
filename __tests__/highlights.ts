import { FastifyInstance } from 'fastify';
import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
} from './helpers';
import { ArticlePost, Source } from '../src/entity';
import { PostHighlight } from '../src/entity/PostHighlight';
import { PostType } from '../src/entity/posts/Post';
import { sourcesFixture } from './fixture/source';
import request from 'supertest';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';

let app: FastifyInstance;
let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(() => new MockContext(con));
  client = state.client;
  app = state.app;
});

afterAll(async () => {
  await disposeGraphQLTesting(state);
});

const createTestPosts = async () => {
  await saveFixtures(con, Source, sourcesFixture);
  await con.getRepository(ArticlePost).save([
    {
      id: 'h1',
      shortId: 'h1',
      title: 'Test Post 1',
      url: 'https://example.com/1',
      score: 0,
      sourceId: 'a',
      visible: true,
      createdAt: new Date(),
      type: PostType.Article,
      metadataChangedAt: new Date(),
    },
    {
      id: 'h2',
      shortId: 'h2',
      title: 'Test Post 2',
      url: 'https://example.com/2',
      score: 0,
      sourceId: 'a',
      visible: true,
      createdAt: new Date(),
      type: PostType.Article,
      metadataChangedAt: new Date(),
    },
    {
      id: 'h3',
      shortId: 'h3',
      title: 'Test Post 3',
      url: 'https://example.com/3',
      score: 0,
      sourceId: 'a',
      visible: true,
      createdAt: new Date(),
      type: PostType.Article,
      metadataChangedAt: new Date(),
    },
  ]);
};

beforeEach(async () => {
  jest.resetAllMocks();
});

const QUERY = `
  query PostHighlights($channel: String!) {
    postHighlights(channel: $channel) {
      channel
      rank
      headline
      post {
        id
        title
      }
    }
  }
`;

describe('query postHighlights', () => {
  it('should return empty array when no highlights exist', async () => {
    const res = await client.query(QUERY, {
      variables: { channel: 'happening-now' },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.postHighlights).toEqual([]);
  });

  it('should return highlights ordered by rank', async () => {
    await createTestPosts();
    await con.getRepository(PostHighlight).save([
      {
        postId: 'h2',
        channel: 'happening-now',
        rank: 2,
        headline: 'Second headline',
      },
      {
        postId: 'h1',
        channel: 'happening-now',
        rank: 1,
        headline: 'First headline',
      },
      {
        postId: 'h3',
        channel: 'happening-now',
        rank: 3,
        headline: 'Third headline',
      },
    ]);

    const res = await client.query(QUERY, {
      variables: { channel: 'happening-now' },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.postHighlights).toHaveLength(3);
    expect(res.data.postHighlights[0]).toMatchObject({
      channel: 'happening-now',
      rank: 1,
      headline: 'First headline',
      post: { id: 'h1', title: 'Test Post 1' },
    });
    expect(res.data.postHighlights[1]).toMatchObject({
      rank: 2,
      headline: 'Second headline',
      post: { id: 'h2' },
    });
    expect(res.data.postHighlights[2]).toMatchObject({
      rank: 3,
      headline: 'Third headline',
      post: { id: 'h3' },
    });
  });

  it('should filter by channel', async () => {
    await createTestPosts();
    await con.getRepository(PostHighlight).save([
      {
        postId: 'h1',
        channel: 'happening-now',
        rank: 1,
        headline: 'Happening now',
      },
      {
        postId: 'h2',
        channel: 'agentic',
        rank: 1,
        headline: 'Agentic highlight',
      },
    ]);

    const res = await client.query(QUERY, {
      variables: { channel: 'agentic' },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.postHighlights).toHaveLength(1);
    expect(res.data.postHighlights[0]).toMatchObject({
      channel: 'agentic',
      headline: 'Agentic highlight',
      post: { id: 'h2' },
    });
  });
});

describe('PUT /p/highlights/:channel', () => {
  it('should return 404 when not authorized', () =>
    request(app.server)
      .put('/p/highlights/happening-now')
      .send([])
      .expect(404));

  it('should reject invalid body', async () => {
    const res = await request(app.server)
      .put('/p/highlights/happening-now')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send([{ postId: '', rank: 0 }]);
    expect(res.status).toBe(400);
  });

  it('should replace all highlights for a channel', async () => {
    await createTestPosts();

    await con.getRepository(PostHighlight).save({
      postId: 'h1',
      channel: 'happening-now',
      rank: 1,
      headline: 'Old headline',
    });

    const res = await request(app.server)
      .put('/p/highlights/happening-now')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send([
        { postId: 'h2', rank: 1, headline: 'New first' },
        { postId: 'h3', rank: 2, headline: 'New second' },
      ]);

    expect(res.status).toBe(200);

    const highlights = await con
      .getRepository(PostHighlight)
      .find({ where: { channel: 'happening-now' }, order: { rank: 'ASC' } });
    expect(highlights).toHaveLength(2);
    expect(highlights[0]).toMatchObject({
      postId: 'h2',
      rank: 1,
      headline: 'New first',
    });
    expect(highlights[1]).toMatchObject({
      postId: 'h3',
      rank: 2,
      headline: 'New second',
    });
  });

  it('should not affect other channels', async () => {
    await createTestPosts();

    await con.getRepository(PostHighlight).save({
      postId: 'h1',
      channel: 'agentic',
      rank: 1,
      headline: 'Agentic stays',
    });

    await request(app.server)
      .put('/p/highlights/happening-now')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send([{ postId: 'h2', rank: 1, headline: 'New happening now' }]);

    const agentic = await con
      .getRepository(PostHighlight)
      .findOneBy({ channel: 'agentic' });
    expect(agentic).toBeTruthy();
    expect(agentic?.headline).toBe('Agentic stays');
  });
});

describe('POST /p/highlights/:channel/items', () => {
  it('should return 404 when not authorized', () =>
    request(app.server)
      .post('/p/highlights/happening-now/items')
      .send({})
      .expect(404));

  it('should add a single highlight', async () => {
    await createTestPosts();

    const res = await request(app.server)
      .post('/p/highlights/happening-now/items')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send({ postId: 'h1', rank: 1, headline: 'Added highlight' });

    expect(res.status).toBe(200);

    const highlight = await con
      .getRepository(PostHighlight)
      .findOneBy({ channel: 'happening-now', postId: 'h1' });
    expect(highlight).toMatchObject({
      postId: 'h1',
      rank: 1,
      headline: 'Added highlight',
    });
  });

  it('should upsert on conflict', async () => {
    await createTestPosts();

    await con.getRepository(PostHighlight).save({
      postId: 'h1',
      channel: 'happening-now',
      rank: 1,
      headline: 'Original',
    });

    const res = await request(app.server)
      .post('/p/highlights/happening-now/items')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send({ postId: 'h1', rank: 5, headline: 'Updated via upsert' });

    expect(res.status).toBe(200);

    const highlights = await con
      .getRepository(PostHighlight)
      .findBy({ channel: 'happening-now', postId: 'h1' });
    expect(highlights).toHaveLength(1);
    expect(highlights[0]).toMatchObject({
      rank: 5,
      headline: 'Updated via upsert',
    });
  });
});

describe('DELETE /p/highlights/:channel/items/:postId', () => {
  it('should return 404 when not authorized', () =>
    request(app.server)
      .delete('/p/highlights/happening-now/items/h1')
      .expect(404));

  it('should delete a highlight', async () => {
    await createTestPosts();

    await con.getRepository(PostHighlight).save({
      postId: 'h1',
      channel: 'happening-now',
      rank: 1,
      headline: 'To be deleted',
    });

    const res = await request(app.server)
      .delete('/p/highlights/happening-now/items/h1')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`);

    expect(res.status).toBe(200);

    const highlight = await con
      .getRepository(PostHighlight)
      .findOneBy({ channel: 'happening-now', postId: 'h1' });
    expect(highlight).toBeNull();
  });
});

describe('PATCH /p/highlights/:channel/items/:postId', () => {
  it('should return 404 when not authorized', () =>
    request(app.server)
      .patch('/p/highlights/happening-now/items/h1')
      .send({})
      .expect(404));

  it('should update rank and headline', async () => {
    await createTestPosts();

    await con.getRepository(PostHighlight).save({
      postId: 'h1',
      channel: 'happening-now',
      rank: 1,
      headline: 'Original headline',
    });

    const res = await request(app.server)
      .patch('/p/highlights/happening-now/items/h1')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send({ rank: 3, headline: 'Updated headline' });

    expect(res.status).toBe(200);

    const highlight = await con
      .getRepository(PostHighlight)
      .findOneBy({ channel: 'happening-now', postId: 'h1' });
    expect(highlight).toMatchObject({
      rank: 3,
      headline: 'Updated headline',
    });
  });

  it('should return 404 for non-existent highlight', async () => {
    const res = await request(app.server)
      .patch('/p/highlights/happening-now/items/nonexistent')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send({ rank: 1 });

    expect(res.status).toBe(404);
  });
});
