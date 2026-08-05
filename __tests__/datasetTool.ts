import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  testQueryErrorCode,
} from './helpers';
import { User } from '../src/entity/user/User';
import { usersFixture } from './fixture/user';
import { UserStack } from '../src/entity/user/UserStack';
import { DatasetTool } from '../src/entity/dataset/DatasetTool';
import { Keyword } from '../src/entity/Keyword';

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
): Partial<UserStack> => ({
  userId,
  toolId,
  section: 'Primary',
  position,
});

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
