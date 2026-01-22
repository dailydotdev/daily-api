import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
} from './helpers';
import { User } from '../src/entity/user/User';
import { usersFixture } from './fixture/user';
import { UserStack } from '../src/entity/user/UserStack';
import { DatasetTool } from '../src/entity/dataset/DatasetTool';

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

beforeEach(async () => {
  loggedUser = null;
  await saveFixtures(con, User, usersFixture);
});

describe('query userStack', () => {
  const QUERY = `
    query UserStack($userId: ID!) {
      userStack(userId: $userId) {
        edges {
          node {
            id
            section
            position
            startedAt
            tool {
              id
              title
              faviconUrl
            }
          }
        }
      }
    }
  `;

  it('should return empty list for user with no stack items', async () => {
    const res = await client.query(QUERY, { variables: { userId: '1' } });
    expect(res.data.userStack.edges).toEqual([]);
  });

  it('should return stack items ordered by position', async () => {
    const tool1 = await con.getRepository(DatasetTool).save({
      title: 'TypeScript',
      titleNormalized: 'typescript',
      faviconSource: 'none',
    });
    const tool2 = await con.getRepository(DatasetTool).save({
      title: 'React',
      titleNormalized: 'react',
      faviconSource: 'none',
    });

    await con.getRepository(UserStack).save([
      { userId: '1', toolId: tool1.id, section: 'Languages', position: 1 },
      { userId: '1', toolId: tool2.id, section: 'Frameworks', position: 0 },
    ]);

    const res = await client.query(QUERY, { variables: { userId: '1' } });
    expect(res.data.userStack.edges).toHaveLength(2);
    expect(res.data.userStack.edges[0].node.tool.title).toBe('React');
    expect(res.data.userStack.edges[1].node.tool.title).toBe('TypeScript');
  });
});

describe('mutation addUserStack', () => {
  const MUTATION = `
    mutation AddUserStack($input: AddUserStackInput!) {
      addUserStack(input: $input) {
        id
        section
        tool {
          title
        }
      }
    }
  `;

  it('should require authentication', async () => {
    const res = await client.mutate(MUTATION, {
      variables: { input: { title: 'Node.js', section: 'Runtime' } },
    });
    expect(res.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('should create stack item and dataset entry', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: { input: { title: 'Node.js', section: 'Runtime' } },
    });

    expect(res.data.addUserStack.section).toBe('Runtime');
    expect(res.data.addUserStack.tool.title).toBe('Node.js');

    const dataset = await con
      .getRepository(DatasetTool)
      .findOneBy({ titleNormalized: 'node.js' });
    expect(dataset).not.toBeNull();
  });

  it('should reuse existing dataset entry', async () => {
    loggedUser = '1';
    await con.getRepository(DatasetTool).save({
      title: 'Python',
      titleNormalized: 'python',
      faviconSource: 'none',
    });

    await client.mutate(MUTATION, {
      variables: { input: { title: 'Python', section: 'Languages' } },
    });

    const count = await con.getRepository(DatasetTool).countBy({
      titleNormalized: 'python',
    });
    expect(count).toBe(1);
  });

  it('should prevent duplicate stack items', async () => {
    loggedUser = '1';
    await client.mutate(MUTATION, {
      variables: { input: { title: 'Go', section: 'Languages' } },
    });

    const res = await client.mutate(MUTATION, {
      variables: { input: { title: 'Go', section: 'Languages' } },
    });

    expect(res.errors?.[0]?.message).toBe(
      'Stack item already exists in your profile',
    );
  });
});

describe('mutation updateUserStack', () => {
  const MUTATION = `
    mutation UpdateUserStack($id: ID!, $input: UpdateUserStackInput!) {
      updateUserStack(id: $id, input: $input) {
        id
        section
        startedAt
      }
    }
  `;

  it('should update stack item', async () => {
    loggedUser = '1';
    const tool = await con.getRepository(DatasetTool).save({
      title: 'Rust',
      titleNormalized: 'rust',
      faviconSource: 'none',
    });
    const userStack = await con.getRepository(UserStack).save({
      userId: '1',
      toolId: tool.id,
      section: 'Languages',
      position: 0,
    });

    const res = await client.mutate(MUTATION, {
      variables: {
        id: userStack.id,
        input: { section: 'Systems', startedAt: '2023-01-15T00:00:00.000Z' },
      },
    });

    expect(res.errors).toBeUndefined();
    expect(res.data.updateUserStack.section).toBe('Systems');
    expect(res.data.updateUserStack.startedAt).toBe('2023-01-15T00:00:00.000Z');
  });

  it('should return error for non-existent item', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: {
        id: '00000000-0000-0000-0000-000000000000',
        input: { section: 'Test' },
      },
    });
    expect(res.errors?.[0]?.message).toBe('Stack item not found');
  });
});

describe('mutation deleteUserStack', () => {
  const MUTATION = `
    mutation DeleteUserStack($id: ID!) {
      deleteUserStack(id: $id) {
        _
      }
    }
  `;

  it('should delete stack item', async () => {
    loggedUser = '1';
    const tool = await con.getRepository(DatasetTool).save({
      title: 'Java',
      titleNormalized: 'java',
      faviconSource: 'none',
    });
    const userStack = await con.getRepository(UserStack).save({
      userId: '1',
      toolId: tool.id,
      section: 'Languages',
      position: 0,
    });

    await client.mutate(MUTATION, { variables: { id: userStack.id } });

    const deleted = await con
      .getRepository(UserStack)
      .findOneBy({ id: userStack.id });
    expect(deleted).toBeNull();
  });
});

describe('mutation reorderUserStack', () => {
  const MUTATION = `
    mutation ReorderUserStack($items: [ReorderUserStackInput!]!) {
      reorderUserStack(items: $items) {
        id
        position
      }
    }
  `;

  it('should update positions', async () => {
    loggedUser = '1';
    const stack1 = await con.getRepository(DatasetTool).save({
      title: 'CSS',
      titleNormalized: 'css',
    });
    const stack2 = await con.getRepository(DatasetTool).save({
      title: 'HTML',
      titleNormalized: 'html',
    });

    const [item1, item2] = await con.getRepository(UserStack).save([
      { userId: '1', toolId: stack1.id, section: 'Web', position: 0 },
      { userId: '1', toolId: stack2.id, section: 'Web', position: 1 },
    ]);

    const res = await client.mutate(MUTATION, {
      variables: {
        items: [
          { id: item1.id, position: 1 },
          { id: item2.id, position: 0 },
        ],
      },
    });

    const reordered = res.data.reorderUserStack;
    expect(
      reordered.find((i: { id: string }) => i.id === item1.id).position,
    ).toBe(1);
    expect(
      reordered.find((i: { id: string }) => i.id === item2.id).position,
    ).toBe(0);
  });
});
