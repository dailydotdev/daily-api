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
import { ArticlePost } from '../src/entity/posts/ArticlePost';
import { ChannelDigest } from '../src/entity/ChannelDigest';
import { ChannelHighlightDefinition } from '../src/entity/ChannelHighlightDefinition';
import { Source, SourceType } from '../src/entity/Source';
import {
  PostHighlight,
  PostHighlightSignificance,
} from '../src/entity/PostHighlight';
import { PostType } from '../src/entity/posts/Post';
import { sourcesFixture } from './fixture/source';

let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(() => new MockContext(con));
  client = state.client;
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
    {
      id: 'h4',
      shortId: 'h4',
      title: 'Test Post 4',
      url: 'https://example.com/4',
      score: 0,
      sourceId: 'a',
      visible: true,
      createdAt: new Date('2026-03-19T12:00:00.000Z'),
      type: PostType.Article,
      metadataChangedAt: new Date('2026-03-19T12:00:00.000Z'),
    },
  ]);
};

beforeEach(async () => {
  jest.resetAllMocks();
  await con.getRepository(ChannelDigest).clear();
  await con.getRepository(ChannelHighlightDefinition).clear();
  await con.getRepository(PostHighlight).clear();
  await con.getRepository(ArticlePost).delete(['h1', 'h2', 'h3', 'h4']);
  await con
    .getRepository(Source)
    .delete(['a', 'b', 'c', 'backend_digest', 'career_digest']);
});

const QUERY = `
  query PostHighlights($channel: String!) {
    postHighlights(channel: $channel) {
      id
      channel
      highlightedAt
      headline
      post {
        id
        title
      }
    }
  }
`;

const MAJOR_HEADLINES_QUERY = `
  query MajorHeadlines($first: Int, $after: String) {
    majorHeadlines(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        cursor
        node {
          id
          channel
          highlightedAt
          headline
          post {
            id
            title
          }
        }
      }
    }
  }
`;

const CHANNEL_CONFIGURATIONS_QUERY = `
  query ChannelConfigurations {
    channelConfigurations {
      channel
      displayName
      digest {
        frequency
        source {
          id
          name
          handle
        }
      }
    }
  }
`;

describe('query channelConfigurations', () => {
  it('should return non-disabled highlight channels with digest metadata', async () => {
    await con.getRepository(Source).save({
      id: 'backend_digest',
      name: 'Backend Digest',
      image: 'https://example.com/backend.png',
      handle: 'backend_digest',
      type: SourceType.Machine,
      active: true,
      private: false,
    });

    await con.getRepository(ChannelHighlightDefinition).save([
      {
        channel: 'career',
        displayName: 'Career Growth',
        mode: 'shadow',
      },
      {
        channel: 'backend',
        displayName: 'Backend Engineering',
        mode: 'publish',
      },
      {
        channel: 'disabled',
        displayName: 'Disabled',
        mode: 'disabled',
      },
    ]);

    await con.getRepository(ChannelDigest).save({
      key: 'backend-digest',
      channel: 'backend',
      sourceId: 'backend_digest',
      targetAudience: 'backend developers',
      frequency: 'daily',
      includeSentiment: false,
      sentimentGroupIds: [],
      enabled: true,
    });

    const res = await client.query(CHANNEL_CONFIGURATIONS_QUERY);

    expect(res.errors).toBeFalsy();
    expect(res.data.channelConfigurations).toEqual([
      {
        channel: 'backend',
        displayName: 'Backend Engineering',
        digest: {
          frequency: 'daily',
          source: {
            id: 'backend_digest',
            name: 'Backend Digest',
            handle: 'backend_digest',
          },
        },
      },
      {
        channel: 'career',
        displayName: 'Career Growth',
        digest: null,
      },
    ]);
  });
});

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

  it('should hide retired highlights', async () => {
    await createTestPosts();
    await con.getRepository(PostHighlight).save([
      {
        postId: 'h1',
        channel: 'happening-now',
        highlightedAt: new Date('2026-03-19T10:00:00.000Z'),
        headline: 'Still live',
        retiredAt: null,
      },
      {
        postId: 'h2',
        channel: 'happening-now',
        highlightedAt: new Date('2026-03-19T10:05:00.000Z'),
        headline: 'Retired headline',
        retiredAt: new Date('2026-03-19T10:10:00.000Z'),
      },
    ]);

    const res = await client.query(QUERY, {
      variables: { channel: 'happening-now' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.postHighlights).toHaveLength(1);
    expect(res.data.postHighlights[0]).toMatchObject({
      channel: 'happening-now',
      headline: 'Still live',
      post: { id: 'h1' },
    });
  });
});

describe('query majorHeadlines', () => {
  it('should return only breaking and major headlines deduplicated by postId', async () => {
    await createTestPosts();
    await con.getRepository(PostHighlight).save([
      {
        postId: 'h1',
        channel: 'agentic',
        highlightedAt: new Date('2026-03-19T10:30:00.000Z'),
        headline: 'Major agentic headline',
        significance: PostHighlightSignificance.Major,
      },
      {
        postId: 'h1',
        channel: 'vibes',
        highlightedAt: new Date('2026-03-19T10:40:00.000Z'),
        headline: 'Newer breaking headline',
        significance: PostHighlightSignificance.Breaking,
      },
      {
        postId: 'h2',
        channel: 'vibes',
        highlightedAt: new Date('2026-03-19T10:35:00.000Z'),
        headline: 'Breaking headline',
        significance: PostHighlightSignificance.Breaking,
      },
      {
        postId: 'h3',
        channel: 'vibes',
        highlightedAt: new Date('2026-03-19T10:20:00.000Z'),
        headline: 'Routine headline',
        significance: PostHighlightSignificance.Routine,
      },
      {
        postId: 'h4',
        channel: 'agentic',
        highlightedAt: new Date('2026-03-19T10:10:00.000Z'),
        headline: 'Major headline',
        significance: PostHighlightSignificance.Major,
      },
    ]);

    const res = await client.query(MAJOR_HEADLINES_QUERY, {
      variables: { first: 10 },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.majorHeadlines.pageInfo.hasNextPage).toBe(false);
    expect(res.data.majorHeadlines.edges).toHaveLength(3);
    expect(res.data.majorHeadlines.edges.map(({ node }) => node)).toEqual([
      expect.objectContaining({
        channel: 'vibes',
        headline: 'Newer breaking headline',
        post: { id: 'h1', title: 'Test Post 1' },
      }),
      expect.objectContaining({
        channel: 'vibes',
        headline: 'Breaking headline',
        post: { id: 'h2', title: 'Test Post 2' },
      }),
      expect.objectContaining({
        channel: 'agentic',
        headline: 'Major headline',
        post: { id: 'h4', title: 'Test Post 4' },
      }),
    ]);
  });

  it('should paginate major headlines ordered by highlightedAt desc', async () => {
    await createTestPosts();
    await con.getRepository(PostHighlight).save([
      {
        postId: 'h1',
        channel: 'vibes',
        highlightedAt: new Date('2026-03-19T10:40:00.000Z'),
        headline: 'Headline 1',
        significance: PostHighlightSignificance.Breaking,
      },
      {
        postId: 'h2',
        channel: 'agentic',
        highlightedAt: new Date('2026-03-19T10:35:00.000Z'),
        headline: 'Headline 2',
        significance: PostHighlightSignificance.Major,
      },
      {
        postId: 'h3',
        channel: 'vibes',
        highlightedAt: new Date('2026-03-19T10:25:00.000Z'),
        headline: 'Headline 3',
        significance: PostHighlightSignificance.Breaking,
      },
    ]);

    const firstPage = await client.query(MAJOR_HEADLINES_QUERY, {
      variables: { first: 2 },
    });

    expect(firstPage.errors).toBeFalsy();
    expect(firstPage.data.majorHeadlines.pageInfo.hasNextPage).toBe(true);
    expect(
      firstPage.data.majorHeadlines.edges.map(({ node }) => node.post.id),
    ).toEqual(['h1', 'h2']);

    const secondPage = await client.query(MAJOR_HEADLINES_QUERY, {
      variables: {
        first: 2,
        after: firstPage.data.majorHeadlines.pageInfo.endCursor,
      },
    });

    expect(secondPage.errors).toBeFalsy();
    expect(secondPage.data.majorHeadlines.pageInfo.hasNextPage).toBe(false);
    expect(
      secondPage.data.majorHeadlines.edges.map(({ node }) => node.post.id),
    ).toEqual(['h3']);
  });

  it('should exclude retired major headlines', async () => {
    await createTestPosts();
    await con.getRepository(PostHighlight).save([
      {
        postId: 'h1',
        channel: 'vibes',
        highlightedAt: new Date('2026-03-19T10:40:00.000Z'),
        headline: 'Live breaking headline',
        significance: PostHighlightSignificance.Breaking,
        retiredAt: null,
      },
      {
        postId: 'h2',
        channel: 'agentic',
        highlightedAt: new Date('2026-03-19T10:35:00.000Z'),
        headline: 'Retired major headline',
        significance: PostHighlightSignificance.Major,
        retiredAt: new Date('2026-03-19T10:45:00.000Z'),
      },
    ]);

    const res = await client.query(MAJOR_HEADLINES_QUERY, {
      variables: { first: 10 },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.majorHeadlines.edges).toHaveLength(1);
    expect(res.data.majorHeadlines.edges[0].node).toMatchObject({
      channel: 'vibes',
      headline: 'Live breaking headline',
      post: { id: 'h1' },
    });
  });
});
