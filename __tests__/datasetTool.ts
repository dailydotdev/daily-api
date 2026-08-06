import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  testMutationErrorCode,
  testQueryErrorCode,
} from './helpers';
import { User } from '../src/entity/user/User';
import { usersFixture } from './fixture/user';
import { UserStack } from '../src/entity/user/UserStack';
import { DatasetTool } from '../src/entity/dataset/DatasetTool';
import { Keyword } from '../src/entity/Keyword';
import { ToolVote } from '../src/entity/ToolVote';
import { ToolComment } from '../src/entity/ToolComment';
import { Feed } from '../src/entity/Feed';
import { HotTake } from '../src/entity/user/HotTake';
import { ContentPreferenceUser } from '../src/entity/contentPreference/ContentPreferenceUser';
import { ContentPreferenceStatus } from '../src/entity/contentPreference/types';

let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string | null = null;

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser),
  );
  client = state.client;
});

afterAll(() => disposeGraphQLTesting(state));

const toolsFixture = [
  {
    title: 'Next.js',
    titleNormalized: 'nextdotjs',
    url: 'https://nextjs.org',
    faviconSource: 'none',
  },
  {
    title: 'React',
    titleNormalized: 'react',
    faviconSource: 'none',
  },
  {
    title: 'Fastify',
    titleNormalized: 'fastify',
    faviconSource: 'none',
  },
  {
    title: 'Redis',
    titleNormalized: 'redis',
    faviconSource: 'none',
  },
];

let tools: DatasetTool[];

beforeEach(async () => {
  loggedUser = null;
  await saveFixtures(con, User, usersFixture);
  tools = await con.getRepository(DatasetTool).save(toolsFixture);
});

const toolByNormalizedTitle = (titleNormalized: string): DatasetTool => {
  const tool = tools.find((t) => t.titleNormalized === titleNormalized);
  if (!tool) {
    throw new Error(`missing tool fixture ${titleNormalized}`);
  }
  return tool;
};

const stackItem = (
  userId: string,
  toolId: string,
  position = 0,
  createdAt?: Date,
): Partial<UserStack> => ({
  userId,
  toolId,
  section: 'Primary',
  position,
  ...(createdAt && { createdAt }),
});

const refreshToolStats = () =>
  con.query('REFRESH MATERIALIZED VIEW tool_stack_stats');

describe('query datasetTool', () => {
  const QUERY = `
    query DatasetTool($slug: String!) {
      datasetTool(slug: $slug) {
        id
        title
        slug
        url
        faviconUrl
        stackCount
        keyword
      }
    }
  `;

  it('should return the tool by slug with defaults', async () => {
    const res = await client.query(QUERY, {
      variables: { slug: 'nextdotjs' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.datasetTool).toMatchObject({
      title: 'Next.js',
      slug: 'nextdotjs',
      url: 'https://nextjs.org',
      stackCount: 0,
      keyword: null,
    });
  });

  it('should normalize the requested slug', async () => {
    const res = await client.query(QUERY, {
      variables: { slug: 'Next.js' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.datasetTool.slug).toEqual('nextdotjs');
  });

  it('should count stacks including the tool', async () => {
    const tool = toolByNormalizedTitle('nextdotjs');
    await con
      .getRepository(UserStack)
      .save([stackItem('1', tool.id), stackItem('2', tool.id)]);

    const res = await client.query(QUERY, {
      variables: { slug: 'nextdotjs' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.datasetTool.stackCount).toEqual(2);
  });

  it('should resolve an allowed keyword matching the stripped title', async () => {
    await con.getRepository(Keyword).save([
      { value: 'nextjs', status: 'allow', occurrences: 100 },
      { value: 'react', status: 'allow', occurrences: 50 },
      { value: 'fastify', status: 'pending', occurrences: 10 },
    ]);

    const [nextRes, reactRes, fastifyRes] = await Promise.all([
      client.query(QUERY, { variables: { slug: 'nextdotjs' } }),
      client.query(QUERY, { variables: { slug: 'react' } }),
      client.query(QUERY, { variables: { slug: 'fastify' } }),
    ]);

    expect(nextRes.data.datasetTool.keyword).toEqual('nextjs');
    expect(reactRes.data.datasetTool.keyword).toEqual('react');
    expect(fastifyRes.data.datasetTool.keyword).toBeNull();
  });

  it('should fail when the tool does not exist', () =>
    testQueryErrorCode(
      client,
      { query: QUERY, variables: { slug: 'doesnotexist' } },
      'NOT_FOUND',
    ));
});

describe('query toolsAlsoStacked', () => {
  const QUERY = `
    query ToolsAlsoStacked($id: ID!, $first: Int) {
      toolsAlsoStacked(id: $id, first: $first) {
        id
        title
      }
    }
  `;

  it('should return co-occurring tools ordered by shared stacks', async () => {
    const next = toolByNormalizedTitle('nextdotjs');
    const react = toolByNormalizedTitle('react');
    const fastify = toolByNormalizedTitle('fastify');
    const redis = toolByNormalizedTitle('redis');

    await con.getRepository(UserStack).save([
      // user 1 stacks next + react + fastify
      stackItem('1', next.id),
      stackItem('1', react.id, 1),
      stackItem('1', fastify.id, 2),
      // user 2 stacks next + react
      stackItem('2', next.id),
      stackItem('2', react.id, 1),
      // user 3 stacks redis only, no next
      stackItem('3', redis.id),
    ]);

    const res = await client.query(QUERY, {
      variables: { id: next.id },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.toolsAlsoStacked).toEqual([
      { id: react.id, title: 'React' },
      { id: fastify.id, title: 'Fastify' },
    ]);
  });

  it('should respect the first argument', async () => {
    const next = toolByNormalizedTitle('nextdotjs');
    const react = toolByNormalizedTitle('react');
    const fastify = toolByNormalizedTitle('fastify');

    await con
      .getRepository(UserStack)
      .save([
        stackItem('1', next.id),
        stackItem('1', react.id, 1),
        stackItem('1', fastify.id, 2),
      ]);

    const res = await client.query(QUERY, {
      variables: { id: next.id, first: 1 },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.toolsAlsoStacked).toHaveLength(1);
  });

  it('should return empty when nobody shares a stack', async () => {
    const redis = toolByNormalizedTitle('redis');
    await con.getRepository(UserStack).save([stackItem('3', redis.id)]);

    const res = await client.query(QUERY, {
      variables: { id: redis.id },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.toolsAlsoStacked).toEqual([]);
  });
});

describe('query toolStackers', () => {
  const QUERY = `
    query ToolStackers($id: ID!, $first: Int) {
      toolStackers(id: $id, first: $first) {
        id
        image
      }
    }
  `;

  it('should return stackers ordered by reputation', async () => {
    const next = toolByNormalizedTitle('nextdotjs');
    await con.getRepository(User).update({ id: '2' }, { reputation: 100 });
    await con
      .getRepository(UserStack)
      .save([stackItem('1', next.id), stackItem('2', next.id)]);

    const res = await client.query(QUERY, {
      variables: { id: next.id },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.toolStackers.map(({ id }) => id)).toEqual(['2', '1']);
  });

  it('should respect the first argument and return empty without stackers', async () => {
    const next = toolByNormalizedTitle('nextdotjs');
    await con
      .getRepository(UserStack)
      .save([stackItem('1', next.id), stackItem('2', next.id)]);

    const [limited, empty] = await Promise.all([
      client.query(QUERY, {
        variables: { id: next.id, first: 1 },
      }),
      client.query(QUERY, {
        variables: { id: toolByNormalizedTitle('redis').id },
      }),
    ]);

    expect(limited.data.toolStackers).toHaveLength(1);
    expect(empty.data.toolStackers).toEqual([]);
  });
});

describe('query toolAdoption', () => {
  const QUERY = `
    query ToolAdoption($id: ID!) {
      toolAdoption(id: $id) {
        stackCount
        percentile
        quarterGrowth
        monthly {
          count
        }
      }
    }
  `;

  it('should return adoption stats with percentile and growth', async () => {
    const next = toolByNormalizedTitle('nextdotjs');
    const react = toolByNormalizedTitle('react');
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    await con
      .getRepository(UserStack)
      .save([
        stackItem('1', next.id, 0, sixMonthsAgo),
        stackItem('2', next.id),
        stackItem('3', react.id),
      ]);
    await refreshToolStats();

    const res = await client.query(QUERY, {
      variables: { id: next.id },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.toolAdoption).toMatchObject({
      stackCount: 2,
      // react has fewer stacks than next: 1 of 2 stacked tools below
      percentile: 0.5,
      // one recent addition against a base of one older item
      quarterGrowth: 100,
    });
    expect(res.data.toolAdoption.monthly).toHaveLength(2);
  });

  it('should return null growth and percentile without history', async () => {
    const redis = toolByNormalizedTitle('redis');
    await con.getRepository(UserStack).save([stackItem('3', redis.id)]);
    await refreshToolStats();

    const res = await client.query(QUERY, {
      variables: { id: redis.id },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.toolAdoption).toMatchObject({
      stackCount: 1,
      percentile: 0,
      quarterGrowth: null,
    });
  });
});

describe('query toolStackersFollowing', () => {
  const QUERY = `
    query ToolStackersFollowing($id: ID!) {
      toolStackersFollowing(id: $id) {
        id
      }
    }
  `;

  it('should require authentication', () =>
    testQueryErrorCode(
      client,
      {
        query: QUERY,
        variables: { id: '00000000-0000-0000-0000-000000000000' },
      },
      'UNAUTHENTICATED',
    ));

  it('should only return stackers the viewer follows', async () => {
    loggedUser = '1';
    const next = toolByNormalizedTitle('nextdotjs');

    await con.getRepository(Feed).save({ id: '1', userId: '1' });
    await con.getRepository(ContentPreferenceUser).save({
      userId: '1',
      referenceId: '2',
      referenceUserId: '2',
      feedId: '1',
      status: ContentPreferenceStatus.Follow,
    });
    await con
      .getRepository(UserStack)
      .save([stackItem('2', next.id), stackItem('3', next.id)]);

    const res = await client.query(QUERY, {
      variables: { id: next.id },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.toolStackersFollowing).toEqual([{ id: '2' }]);
  });
});

describe('query toolTakes', () => {
  const QUERY = `
    query ToolTakes($id: ID!) {
      toolTakes(id: $id) {
        title
        upvotes
      }
    }
  `;

  it('should return takes mentioning the tool ordered by upvotes', async () => {
    const next = toolByNormalizedTitle('nextdotjs');
    await con.getRepository(HotTake).save([
      {
        userId: '1',
        emoji: '🔥',
        title: 'Next.js app router finally clicked for me',
        position: 0,
        upvotes: 3,
      },
      {
        userId: '2',
        emoji: '⚡',
        title: 'Pin your versions, Next.js ships fast',
        position: 0,
        upvotes: 7,
      },
      {
        userId: '3',
        emoji: '🧠',
        title: 'nextjs without the dot does not match',
        position: 0,
        upvotes: 10,
      },
    ]);

    const res = await client.query(QUERY, {
      variables: { id: next.id },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.toolTakes).toEqual([
      { title: 'Pin your versions, Next.js ships fast', upvotes: 7 },
      { title: 'Next.js app router finally clicked for me', upvotes: 3 },
    ]);
  });

  it('should skip short tool titles to avoid noisy matches', async () => {
    const go = await con.getRepository(DatasetTool).save({
      title: 'Go',
      titleNormalized: 'go',
      faviconSource: 'none',
    });
    await con.getRepository(HotTake).save({
      userId: '1',
      emoji: '🐹',
      title: 'Go is the best language',
      position: 0,
      upvotes: 5,
    });

    const res = await client.query(QUERY, {
      variables: { id: go.id },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.toolTakes).toEqual([]);
  });
});

describe('query topTools', () => {
  const QUERY = `
    query TopTools($first: Int, $category: String, $trending: Boolean) {
      topTools(first: $first, category: $category, trending: $trending) {
        title
        category
      }
    }
  `;

  beforeEach(async () => {
    const next = toolByNormalizedTitle('nextdotjs');
    const react = toolByNormalizedTitle('react');
    const redis = toolByNormalizedTitle('redis');
    await con
      .getRepository(DatasetTool)
      .update({ id: next.id }, { category: 'Frameworks' });
    await con
      .getRepository(DatasetTool)
      .update({ id: react.id }, { category: 'Frameworks' });
    await con
      .getRepository(DatasetTool)
      .update({ id: redis.id }, { category: 'Databases' });

    const old = new Date();
    old.setMonth(old.getMonth() - 6);
    await con.getRepository(UserStack).save([
      // react: 3 stacks but only old additions
      stackItem('1', react.id, 0, old),
      stackItem('2', react.id, 0, old),
      stackItem('3', react.id, 0, old),
      // next: 2 recent stacks
      stackItem('1', next.id),
      stackItem('2', next.id),
      // redis: 1 recent stack
      stackItem('3', redis.id),
    ]);
    await refreshToolStats();
  });

  it('should order by total stacks and support category filter', async () => {
    const [all, frameworks] = await Promise.all([
      client.query(QUERY, { variables: {} }),
      client.query(QUERY, { variables: { category: 'Frameworks' } }),
    ]);

    expect(all.errors).toBeFalsy();
    expect(all.data.topTools.map(({ title }) => title)).toEqual([
      'React',
      'Next.js',
      'Redis',
    ]);
    expect(frameworks.data.topTools.map(({ title }) => title)).toEqual([
      'React',
      'Next.js',
    ]);
  });

  it('should rank by recent additions when trending', async () => {
    const res = await client.query(QUERY, {
      variables: { trending: true },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.topTools.map(({ title }) => title)).toEqual([
      'Next.js',
      'Redis',
    ]);
  });
});

describe('query toolCategories', () => {
  const QUERY = `
    query ToolCategories {
      toolCategories {
        category
        toolCount
      }
    }
  `;

  it('should return categories ordered by stack presence', async () => {
    const next = toolByNormalizedTitle('nextdotjs');
    const redis = toolByNormalizedTitle('redis');
    await con
      .getRepository(DatasetTool)
      .update({ id: next.id }, { category: 'Frameworks' });
    await con
      .getRepository(DatasetTool)
      .update({ id: redis.id }, { category: 'Databases' });
    await con
      .getRepository(UserStack)
      .save([
        stackItem('1', redis.id),
        stackItem('2', redis.id),
        stackItem('1', next.id),
      ]);
    await refreshToolStats();

    const res = await client.query(QUERY, { variables: {} });

    expect(res.errors).toBeFalsy();
    expect(res.data.toolCategories).toEqual([
      { category: 'Databases', toolCount: 1 },
      { category: 'Frameworks', toolCount: 1 },
    ]);
  });
});

describe('mutation voteTool', () => {
  const MUTATION = `
    mutation VoteTool($id: ID!, $vote: Int!) {
      voteTool(id: $id, vote: $vote) {
        _
      }
    }
  `;

  const TOOL_QUERY = `
    query DatasetTool($slug: String!) {
      datasetTool(slug: $slug) {
        upvotes
        downvotes
        userVote
      }
    }
  `;

  it('should require authentication', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: '00000000-0000-0000-0000-000000000000', vote: 1 },
      },
      'UNAUTHENTICATED',
    ));

  it('should fail on unknown tool', () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: '00000000-0000-0000-0000-000000000000', vote: 1 },
      },
      'NOT_FOUND',
    );
  });

  it('should upvote, change vote and clear it', async () => {
    loggedUser = '1';
    const next = toolByNormalizedTitle('nextdotjs');

    const up = await client.mutate(MUTATION, {
      variables: { id: next.id, vote: 1 },
    });
    expect(up.errors).toBeFalsy();

    let res = await client.query(TOOL_QUERY, {
      variables: { slug: 'nextdotjs' },
    });
    expect(res.data.datasetTool).toEqual({
      upvotes: 1,
      downvotes: 0,
      userVote: 1,
    });

    await client.mutate(MUTATION, { variables: { id: next.id, vote: -1 } });
    res = await client.query(TOOL_QUERY, { variables: { slug: 'nextdotjs' } });
    expect(res.data.datasetTool).toEqual({
      upvotes: 0,
      downvotes: 1,
      userVote: -1,
    });

    await client.mutate(MUTATION, { variables: { id: next.id, vote: 0 } });
    res = await client.query(TOOL_QUERY, { variables: { slug: 'nextdotjs' } });
    expect(res.data.datasetTool).toEqual({
      upvotes: 0,
      downvotes: 0,
      userVote: null,
    });
    expect(
      await con
        .getRepository(ToolVote)
        .countBy({ userId: '1', toolId: next.id }),
    ).toEqual(0);
  });

  it('should return null userVote for anonymous viewers', async () => {
    loggedUser = '1';
    const next = toolByNormalizedTitle('nextdotjs');
    await client.mutate(MUTATION, { variables: { id: next.id, vote: 1 } });

    loggedUser = null;
    const res = await client.query(TOOL_QUERY, {
      variables: { slug: 'nextdotjs' },
    });
    expect(res.data.datasetTool).toEqual({
      upvotes: 1,
      downvotes: 0,
      userVote: null,
    });
  });
});

describe('tool comments', () => {
  const COMMENT_MUTATION = `
    mutation CommentOnTool($id: ID!, $content: String!, $parentId: ID) {
      commentOnTool(id: $id, content: $content, parentId: $parentId) {
        id
        content
        contentHtml
        user {
          id
        }
      }
    }
  `;

  const COMMENTS_QUERY = `
    query ToolComments($id: ID!) {
      toolComments(id: $id) {
        edges {
          node {
            id
            content
            replies {
              content
            }
          }
        }
      }
    }
  `;

  const DELETE_MUTATION = `
    mutation DeleteToolComment($id: ID!) {
      deleteToolComment(id: $id) {
        _
      }
    }
  `;

  it('should require authentication to comment', () =>
    testMutationErrorCode(
      client,
      {
        mutation: COMMENT_MUTATION,
        variables: {
          id: '00000000-0000-0000-0000-000000000000',
          content: 'hi',
        },
      },
      'UNAUTHENTICATED',
    ));

  it('should create a comment with rendered markdown', async () => {
    loggedUser = '1';
    const next = toolByNormalizedTitle('nextdotjs');

    const res = await client.mutate(COMMENT_MUTATION, {
      variables: { id: next.id, content: 'Great **framework**' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.commentOnTool).toMatchObject({
      content: 'Great **framework**',
      user: { id: '1' },
    });
    expect(res.data.commentOnTool.contentHtml).toContain(
      '<strong>framework</strong>',
    );
  });

  it('should thread one level of replies and list newest first', async () => {
    loggedUser = '1';
    const next = toolByNormalizedTitle('nextdotjs');

    const first = await client.mutate(COMMENT_MUTATION, {
      variables: { id: next.id, content: 'first comment' },
    });
    loggedUser = '2';
    await client.mutate(COMMENT_MUTATION, {
      variables: {
        id: next.id,
        content: 'a reply',
        parentId: first.data.commentOnTool.id,
      },
    });
    await client.mutate(COMMENT_MUTATION, {
      variables: { id: next.id, content: 'second comment' },
    });

    const res = await client.query(COMMENTS_QUERY, {
      variables: { id: next.id },
    });

    expect(res.errors).toBeFalsy();
    expect(
      res.data.toolComments.edges.map(({ node }) => ({
        content: node.content,
        replies: node.replies?.map((reply) => reply.content) ?? [],
      })),
    ).toEqual([
      { content: 'second comment', replies: [] },
      { content: 'first comment', replies: ['a reply'] },
    ]);
  });

  it('should reject replying to a reply', async () => {
    loggedUser = '1';
    const next = toolByNormalizedTitle('nextdotjs');

    const top = await client.mutate(COMMENT_MUTATION, {
      variables: { id: next.id, content: 'top' },
    });
    const reply = await client.mutate(COMMENT_MUTATION, {
      variables: {
        id: next.id,
        content: 'reply',
        parentId: top.data.commentOnTool.id,
      },
    });

    return testMutationErrorCode(
      client,
      {
        mutation: COMMENT_MUTATION,
        variables: {
          id: next.id,
          content: 'nested',
          parentId: reply.data.commentOnTool.id,
        },
      },
      'FORBIDDEN',
    );
  });

  it('should only allow deleting own comments', async () => {
    loggedUser = '1';
    const next = toolByNormalizedTitle('nextdotjs');
    const comment = await client.mutate(COMMENT_MUTATION, {
      variables: { id: next.id, content: 'mine' },
    });
    const commentId = comment.data.commentOnTool.id;

    loggedUser = '2';
    await testMutationErrorCode(
      client,
      { mutation: DELETE_MUTATION, variables: { id: commentId } },
      'FORBIDDEN',
    );

    loggedUser = '1';
    const res = await client.mutate(DELETE_MUTATION, {
      variables: { id: commentId },
    });
    expect(res.errors).toBeFalsy();
    expect(
      await con.getRepository(ToolComment).countBy({ id: commentId }),
    ).toEqual(0);
  });
});
