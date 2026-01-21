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
import { DatasetTool } from '../src/entity/dataset/DatasetTool';
import { UserTool } from '../src/entity/user/UserTool';

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

describe('query userTools', () => {
  const QUERY = `
    query UserTools($userId: ID!) {
      userTools(userId: $userId) {
        edges {
          node {
            id
            category
            position
            tool {
              id
              title
              url
            }
          }
        }
      }
    }
  `;

  it('should return empty list for user with no tools', async () => {
    const res = await client.query(QUERY, { variables: { userId: '1' } });
    expect(res.data.userTools.edges).toEqual([]);
  });

  it('should return tools ordered by position', async () => {
    const tool1 = await con.getRepository(DatasetTool).save({
      title: 'VS Code',
      titleNormalized: 'vs code',
      faviconSource: 'none',
    });
    const tool2 = await con.getRepository(DatasetTool).save({
      title: 'Figma',
      titleNormalized: 'figma',
      faviconSource: 'none',
    });

    await con.getRepository(UserTool).save([
      { userId: '1', toolId: tool1.id, category: 'Development', position: 1 },
      { userId: '1', toolId: tool2.id, category: 'Design', position: 0 },
    ]);

    const res = await client.query(QUERY, { variables: { userId: '1' } });
    expect(res.data.userTools.edges).toHaveLength(2);
    expect(res.data.userTools.edges[0].node.tool.title).toBe('Figma');
    expect(res.data.userTools.edges[1].node.tool.title).toBe('VS Code');
  });
});

describe('query searchTools', () => {
  const QUERY = `
    query SearchTools($query: String!) {
      searchTools(query: $query) {
        id
        title
      }
    }
  `;

  it('should return matching tools', async () => {
    await con.getRepository(DatasetTool).save([
      { title: 'VS Code', titleNormalized: 'vs code', faviconSource: 'none' },
      {
        title: 'Visual Studio',
        titleNormalized: 'visual studio',
        faviconSource: 'none',
      },
      { title: 'Figma', titleNormalized: 'figma', faviconSource: 'none' },
    ]);

    const res = await client.query(QUERY, { variables: { query: 'visual' } });
    expect(res.data.searchTools).toHaveLength(2);
  });

  it('should return empty for no matches', async () => {
    const res = await client.query(QUERY, { variables: { query: 'xyz' } });
    expect(res.data.searchTools).toEqual([]);
  });
});

describe('mutation addUserTool', () => {
  const MUTATION = `
    mutation AddUserTool($input: AddUserToolInput!) {
      addUserTool(input: $input) {
        id
        category
        tool {
          title
          url
        }
      }
    }
  `;

  it('should require authentication', async () => {
    const res = await client.mutate(MUTATION, {
      variables: { input: { title: 'VS Code', category: 'Development' } },
    });
    expect(res.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('should create tool and dataset entry with auto-detected favicon', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: {
        input: {
          title: 'VS Code',
          url: 'https://code.visualstudio.com',
          category: 'Development',
        },
      },
    });

    expect(res.data.addUserTool.category).toBe('Development');
    expect(res.data.addUserTool.tool.title).toBe('VS Code');
    expect(res.data.addUserTool.tool.url).toBe('https://code.visualstudio.com');

    const dataset = await con
      .getRepository(DatasetTool)
      .findOneBy({ titleNormalized: 'vs code' });
    expect(dataset).not.toBeNull();
    expect(dataset?.faviconUrl).toBe(
      'https://www.google.com/s2/favicons?domain=code.visualstudio.com&sz=128',
    );
    expect(dataset?.faviconSource).toBe('google');
  });

  it('should create tool without favicon when no URL provided', async () => {
    loggedUser = '1';
    await client.mutate(MUTATION, {
      variables: { input: { title: 'MyTool', category: 'Other' } },
    });

    const dataset = await con
      .getRepository(DatasetTool)
      .findOneBy({ titleNormalized: 'mytool' });
    expect(dataset).not.toBeNull();
    expect(dataset?.faviconUrl).toBeNull();
    expect(dataset?.faviconSource).toBe('none');
  });

  it('should reuse existing dataset entry', async () => {
    loggedUser = '1';
    await con.getRepository(DatasetTool).save({
      title: 'Figma',
      titleNormalized: 'figma',
      faviconSource: 'none',
    });

    await client.mutate(MUTATION, {
      variables: { input: { title: 'Figma', category: 'Design' } },
    });

    const count = await con.getRepository(DatasetTool).countBy({
      titleNormalized: 'figma',
    });
    expect(count).toBe(1);
  });

  it('should update existing tool favicon when URL is provided', async () => {
    loggedUser = '1';
    await con.getRepository(DatasetTool).save({
      title: 'Figma',
      titleNormalized: 'figma',
      faviconSource: 'none',
      faviconUrl: null,
    });

    await client.mutate(MUTATION, {
      variables: {
        input: {
          title: 'Figma',
          url: 'https://www.figma.com',
          category: 'Design',
        },
      },
    });

    const dataset = await con
      .getRepository(DatasetTool)
      .findOneBy({ titleNormalized: 'figma' });
    expect(dataset?.faviconUrl).toBe(
      'https://www.google.com/s2/favicons?domain=www.figma.com&sz=128',
    );
    expect(dataset?.faviconSource).toBe('google');
  });

  it('should prevent duplicate tools', async () => {
    loggedUser = '1';
    await client.mutate(MUTATION, {
      variables: { input: { title: 'Slack', category: 'Communication' } },
    });

    const res = await client.mutate(MUTATION, {
      variables: { input: { title: 'Slack', category: 'Communication' } },
    });

    expect(res.errors?.[0]?.message).toBe(
      'Tool already exists in your profile',
    );
  });
});

describe('mutation updateUserTool', () => {
  const MUTATION = `
    mutation UpdateUserTool($id: ID!, $input: UpdateUserToolInput!) {
      updateUserTool(id: $id, input: $input) {
        id
        category
      }
    }
  `;

  it('should update tool category', async () => {
    loggedUser = '1';
    const tool = await con.getRepository(DatasetTool).save({
      title: 'Notion',
      titleNormalized: 'notion',
      faviconSource: 'none',
    });
    const userTool = await con.getRepository(UserTool).save({
      userId: '1',
      toolId: tool.id,
      category: 'Productivity',
      position: 0,
    });

    const res = await client.mutate(MUTATION, {
      variables: {
        id: userTool.id,
        input: { category: 'Documentation' },
      },
    });

    expect(res.errors).toBeUndefined();
    expect(res.data.updateUserTool.category).toBe('Documentation');
  });

  it('should return error for non-existent item', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: {
        id: '00000000-0000-0000-0000-000000000000',
        input: { category: 'Test' },
      },
    });
    expect(res.errors?.[0]?.message).toBe('Tool not found');
  });
});

describe('mutation deleteUserTool', () => {
  const MUTATION = `
    mutation DeleteUserTool($id: ID!) {
      deleteUserTool(id: $id) {
        _
      }
    }
  `;

  it('should delete tool', async () => {
    loggedUser = '1';
    const tool = await con.getRepository(DatasetTool).save({
      title: 'Postman',
      titleNormalized: 'postman',
      faviconSource: 'none',
    });
    const userTool = await con.getRepository(UserTool).save({
      userId: '1',
      toolId: tool.id,
      category: 'Development',
      position: 0,
    });

    await client.mutate(MUTATION, { variables: { id: userTool.id } });

    const deleted = await con
      .getRepository(UserTool)
      .findOneBy({ id: userTool.id });
    expect(deleted).toBeNull();
  });
});

describe('mutation reorderUserTools', () => {
  const MUTATION = `
    mutation ReorderUserTools($items: [ReorderUserToolInput!]!) {
      reorderUserTools(items: $items) {
        id
        position
      }
    }
  `;

  it('should update positions', async () => {
    loggedUser = '1';
    const tool1 = await con.getRepository(DatasetTool).save({
      title: 'Chrome',
      titleNormalized: 'chrome',
      faviconSource: 'none',
    });
    const tool2 = await con.getRepository(DatasetTool).save({
      title: 'Firefox',
      titleNormalized: 'firefox',
      faviconSource: 'none',
    });

    const [item1, item2] = await con.getRepository(UserTool).save([
      { userId: '1', toolId: tool1.id, category: 'Browser', position: 0 },
      { userId: '1', toolId: tool2.id, category: 'Browser', position: 1 },
    ]);

    const res = await client.mutate(MUTATION, {
      variables: {
        items: [
          { id: item1.id, position: 1 },
          { id: item2.id, position: 0 },
        ],
      },
    });

    const reordered = res.data.reorderUserTools;
    expect(
      reordered.find((i: { id: string }) => i.id === item1.id).position,
    ).toBe(1);
    expect(
      reordered.find((i: { id: string }) => i.id === item2.id).position,
    ).toBe(0);
  });
});
