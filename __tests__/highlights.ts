import { FastifyInstance } from 'fastify';
import request from 'supertest';
import { DataSource } from 'typeorm';
import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
} from './helpers';
import createOrGetConnection from '../src/db';
import { ArticlePost, Source } from '../src/entity';
import { PostHighlight } from '../src/entity/PostHighlight';
import { PostType } from '../src/entity/posts/Post';
import { sourcesFixture } from './fixture/source';

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
      createdAt: new Date('2026-03-19T09:00:00.000Z'),
      type: PostType.Article,
      metadataChangedAt: new Date('2026-03-19T09:00:00.000Z'),
    },
    {
      id: 'h2',
      shortId: 'h2',
      title: 'Test Post 2',
      url: 'https://example.com/2',
      score: 0,
      sourceId: 'a',
      visible: true,
      createdAt: new Date('2026-03-19T10:00:00.000Z'),
      type: PostType.Article,
      metadataChangedAt: new Date('2026-03-19T10:00:00.000Z'),
    },
    {
      id: 'h3',
      shortId: 'h3',
      title: 'Test Post 3',
      url: 'https://example.com/3',
      score: 0,
      sourceId: 'a',
      visible: true,
      createdAt: new Date('2026-03-19T11:00:00.000Z'),
      type: PostType.Article,
      metadataChangedAt: new Date('2026-03-19T11:00:00.000Z'),
    },
  ]);
};

beforeEach(async () => {
  jest.resetAllMocks();
  await con.getRepository(PostHighlight).clear();
  await con.getRepository(ArticlePost).delete(['h1', 'h2', 'h3']);
  await con.getRepository(Source).delete(['a', 'b', 'c']);
});

const QUERY = `
  query PostHighlights($channel: String!) {
    postHighlights(channel: $channel) {
      id
      channel
      highlightedAt
      headline
      significanceLabel
      reason
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

  it('should return highlights ordered by highlightedAt desc', async () => {
    await createTestPosts();
    await con.getRepository(PostHighlight).save([
      {
        postId: 'h2',
        channel: 'happening-now',
        highlightedAt: new Date('2026-03-19T10:10:00.000Z'),
        headline: 'Second headline',
      },
      {
        postId: 'h1',
        channel: 'happening-now',
        highlightedAt: new Date('2026-03-19T10:20:00.000Z'),
        headline: 'First headline',
      },
      {
        postId: 'h3',
        channel: 'happening-now',
        highlightedAt: new Date('2026-03-19T10:00:00.000Z'),
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
      headline: 'First headline',
      post: { id: 'h1', title: 'Test Post 1' },
    });
    expect(res.data.postHighlights[1]).toMatchObject({
      headline: 'Second headline',
      post: { id: 'h2' },
    });
    expect(res.data.postHighlights[2]).toMatchObject({
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
        highlightedAt: new Date('2026-03-19T10:00:00.000Z'),
        headline: 'Happening now',
      },
      {
        postId: 'h2',
        channel: 'agentic',
        highlightedAt: new Date('2026-03-19T10:05:00.000Z'),
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
      .send([{ postId: '' }]);

    expect(res.status).toBe(400);
  });

  it('should reject duplicate postIds in a bulk payload', async () => {
    await createTestPosts();

    const res = await request(app.server)
      .put('/p/highlights/happening-now')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send([
        { postId: 'h1', headline: 'First copy' },
        { postId: 'h1', headline: 'Second copy' },
      ]);

    expect(res.status).toBe(400);
  });

  it('should reject mixed timestamp ordering in a bulk payload', async () => {
    await createTestPosts();

    const res = await request(app.server)
      .put('/p/highlights/happening-now')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send([
        {
          postId: 'h1',
          highlightedAt: '2026-03-19T10:05:00.000Z',
          headline: 'Timestamped',
        },
        {
          postId: 'h2',
          headline: 'Untimestamped',
        },
      ]);

    expect(res.status).toBe(400);
  });

  it('should replace all highlights for a channel', async () => {
    await createTestPosts();

    await con.getRepository(PostHighlight).save({
      postId: 'h1',
      channel: 'happening-now',
      highlightedAt: new Date('2026-03-19T09:55:00.000Z'),
      headline: 'Old headline',
    });

    const res = await request(app.server)
      .put('/p/highlights/happening-now')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send([
        {
          postId: 'h2',
          highlightedAt: '2026-03-19T10:05:00.000Z',
          headline: 'New first',
        },
        {
          postId: 'h3',
          highlightedAt: '2026-03-19T10:00:00.000Z',
          headline: 'New second',
        },
      ]);

    expect(res.status).toBe(200);

    const highlights = await con.getRepository(PostHighlight).find({
      where: { channel: 'happening-now' },
      order: { highlightedAt: 'DESC' },
    });
    expect(highlights).toHaveLength(2);
    expect(highlights[0]).toMatchObject({
      postId: 'h2',
      headline: 'New first',
    });
    expect(highlights[1]).toMatchObject({
      postId: 'h3',
      headline: 'New second',
    });
  });

  it('should accept legacy rank ordering', async () => {
    await createTestPosts();

    const res = await request(app.server)
      .put('/p/highlights/happening-now')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send([
        { postId: 'h3', rank: 3, headline: 'Third legacy' },
        { postId: 'h1', rank: 1, headline: 'First legacy' },
        { postId: 'h2', rank: 2, headline: 'Second legacy' },
      ]);

    expect(res.status).toBe(200);

    const highlights = await con.getRepository(PostHighlight).find({
      where: { channel: 'happening-now' },
      order: { highlightedAt: 'DESC' },
    });
    expect(highlights.map((highlight) => highlight.postId)).toEqual([
      'h1',
      'h2',
      'h3',
    ]);
  });

  it('should not affect other channels', async () => {
    await createTestPosts();

    await con.getRepository(PostHighlight).save({
      postId: 'h1',
      channel: 'agentic',
      highlightedAt: new Date('2026-03-19T09:55:00.000Z'),
      headline: 'Agentic stays',
    });

    await request(app.server)
      .put('/p/highlights/happening-now')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send([{ postId: 'h2', headline: 'New happening now' }]);

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
      .send({ postId: 'h1', headline: 'Added highlight' });

    expect(res.status).toBe(200);

    const highlight = await con
      .getRepository(PostHighlight)
      .findOneBy({ channel: 'happening-now', postId: 'h1' });
    expect(highlight).toMatchObject({
      postId: 'h1',
      headline: 'Added highlight',
    });
    expect(highlight?.highlightedAt).toBeInstanceOf(Date);
  });

  it('should reject rank together with highlightedAt', async () => {
    await createTestPosts();

    const res = await request(app.server)
      .post('/p/highlights/happening-now/items')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send({
        postId: 'h1',
        rank: 1,
        highlightedAt: '2026-03-19T10:10:00.000Z',
        headline: 'Ambiguous ordering',
      });

    expect(res.status).toBe(400);
  });

  it('should upsert on conflict', async () => {
    await createTestPosts();

    await con.getRepository(PostHighlight).save({
      postId: 'h1',
      channel: 'happening-now',
      highlightedAt: new Date('2026-03-19T09:55:00.000Z'),
      headline: 'Original',
    });

    const res = await request(app.server)
      .post('/p/highlights/happening-now/items')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send({
        postId: 'h1',
        highlightedAt: '2026-03-19T10:10:00.000Z',
        headline: 'Updated via upsert',
        significanceLabel: 'major',
        reason: 'editorial test',
      });

    expect(res.status).toBe(200);

    const highlights = await con
      .getRepository(PostHighlight)
      .findBy({ channel: 'happening-now', postId: 'h1' });
    expect(highlights).toHaveLength(1);
    expect(highlights[0]).toMatchObject({
      headline: 'Updated via upsert',
      significanceLabel: 'major',
      reason: 'editorial test',
    });
  });

  it('should accept legacy rank when inserting a single highlight', async () => {
    await createTestPosts();

    await con.getRepository(PostHighlight).save([
      {
        postId: 'h1',
        channel: 'happening-now',
        highlightedAt: new Date('2026-03-19T10:00:00.000Z'),
        headline: 'First headline',
      },
      {
        postId: 'h3',
        channel: 'happening-now',
        highlightedAt: new Date('2026-03-19T09:00:00.000Z'),
        headline: 'Third headline',
      },
    ]);

    const res = await request(app.server)
      .post('/p/highlights/happening-now/items')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send({ postId: 'h2', rank: 2, headline: 'Second headline' });

    expect(res.status).toBe(200);

    const highlights = await con.getRepository(PostHighlight).find({
      where: { channel: 'happening-now' },
      order: { highlightedAt: 'DESC' },
    });
    expect(highlights.map((highlight) => highlight.postId)).toEqual([
      'h1',
      'h2',
      'h3',
    ]);
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
      highlightedAt: new Date('2026-03-19T09:55:00.000Z'),
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

  it('should update highlight fields', async () => {
    await createTestPosts();

    await con.getRepository(PostHighlight).save({
      postId: 'h1',
      channel: 'happening-now',
      highlightedAt: new Date('2026-03-19T09:55:00.000Z'),
      headline: 'Original headline',
    });

    const res = await request(app.server)
      .patch('/p/highlights/happening-now/items/h1')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send({
        highlightedAt: '2026-03-19T10:15:00.000Z',
        headline: 'Updated headline',
        significanceLabel: 'breaking',
        reason: 'manual update',
      });

    expect(res.status).toBe(200);

    const highlight = await con
      .getRepository(PostHighlight)
      .findOneBy({ channel: 'happening-now', postId: 'h1' });
    expect(highlight).toMatchObject({
      headline: 'Updated headline',
      significanceLabel: 'breaking',
      reason: 'manual update',
    });
    expect(highlight?.highlightedAt.toISOString()).toBe(
      '2026-03-19T10:15:00.000Z',
    );
  });

  it('should reject an empty update body', async () => {
    await createTestPosts();

    await con.getRepository(PostHighlight).save({
      postId: 'h1',
      channel: 'happening-now',
      highlightedAt: new Date('2026-03-19T09:55:00.000Z'),
      headline: 'Original headline',
    });

    const res = await request(app.server)
      .patch('/p/highlights/happening-now/items/h1')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('should return 404 for non-existent highlight', async () => {
    const res = await request(app.server)
      .patch('/p/highlights/happening-now/items/nonexistent')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send({ headline: 'Updated headline' });

    expect(res.status).toBe(404);
  });

  it('should accept legacy rank when reordering a highlight', async () => {
    await createTestPosts();

    await con.getRepository(PostHighlight).save([
      {
        postId: 'h1',
        channel: 'happening-now',
        highlightedAt: new Date('2026-03-19T10:00:00.000Z'),
        headline: 'First headline',
      },
      {
        postId: 'h2',
        channel: 'happening-now',
        highlightedAt: new Date('2026-03-19T09:00:00.000Z'),
        headline: 'Second headline',
      },
      {
        postId: 'h3',
        channel: 'happening-now',
        highlightedAt: new Date('2026-03-19T08:00:00.000Z'),
        headline: 'Third headline',
      },
    ]);

    const res = await request(app.server)
      .patch('/p/highlights/happening-now/items/h3')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send({
        rank: 1,
        headline: 'Third promoted',
        significanceLabel: 'major',
      });

    expect(res.status).toBe(200);

    const highlights = await con.getRepository(PostHighlight).find({
      where: { channel: 'happening-now' },
      order: { highlightedAt: 'DESC' },
    });
    expect(highlights.map((highlight) => highlight.postId)).toEqual([
      'h3',
      'h1',
      'h2',
    ]);
    expect(highlights[0]).toMatchObject({
      headline: 'Third promoted',
      significanceLabel: 'major',
    });
  });
});
