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
import { SourceStack } from '../src/entity/sources/SourceStack';
import { DatasetTool } from '../src/entity/dataset/DatasetTool';
import { Source, SourceMember } from '../src/entity';
import { SourceMemberRoles } from '../src/roles';
import { sourcesFixture } from './fixture/source';

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
  await saveFixtures(con, Source, sourcesFixture);
});

describe('query sourceStack', () => {
  const QUERY = `
    query SourceStack($sourceId: ID!) {
      sourceStack(sourceId: $sourceId) {
        edges {
          node {
            id
            section
            position
            tool {
              id
              title
              faviconUrl
            }
            createdBy {
              id
            }
          }
        }
      }
    }
  `;

  it('should return empty list for source with no stack items', async () => {
    // Add user as member to view
    await con.getRepository(SourceMember).save({
      userId: '1',
      sourceId: 'squad',
      role: SourceMemberRoles.Member,
      referralToken: 'token1',
    });
    loggedUser = '1';
    const res = await client.query(QUERY, { variables: { sourceId: 'squad' } });
    expect(res.data.sourceStack.edges).toEqual([]);
  });

  it('should return stack items ordered by position', async () => {
    // Add user as member to view
    await con.getRepository(SourceMember).save({
      userId: '1',
      sourceId: 'squad',
      role: SourceMemberRoles.Member,
      referralToken: 'token1',
    });
    loggedUser = '1';

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

    await con.getRepository(SourceStack).save([
      {
        sourceId: 'squad',
        toolId: tool1.id,
        section: 'Languages',
        position: 1,
        createdById: '1',
      },
      {
        sourceId: 'squad',
        toolId: tool2.id,
        section: 'Frameworks',
        position: 0,
        createdById: '1',
      },
    ]);

    const res = await client.query(QUERY, { variables: { sourceId: 'squad' } });
    expect(res.data.sourceStack.edges).toHaveLength(2);
    expect(res.data.sourceStack.edges[0].node.tool.title).toBe('React');
    expect(res.data.sourceStack.edges[1].node.tool.title).toBe('TypeScript');
  });

  it('should allow viewing stack for public squad without being a member', async () => {
    const tool = await con.getRepository(DatasetTool).save({
      title: 'Go',
      titleNormalized: 'go',
      faviconSource: 'none',
    });

    await con.getRepository(SourceStack).save({
      sourceId: 'm', // 'm' is public squad
      toolId: tool.id,
      section: 'Languages',
      position: 0,
      createdById: '1',
    });

    // No member, public squad
    const res = await client.query(QUERY, { variables: { sourceId: 'm' } });
    expect(res.data.sourceStack.edges).toHaveLength(1);
    expect(res.data.sourceStack.edges[0].node.tool.title).toBe('Go');
  });
});

describe('mutation addSourceStack', () => {
  const MUTATION = `
    mutation AddSourceStack($sourceId: ID!, $input: AddSourceStackInput!) {
      addSourceStack(sourceId: $sourceId, input: $input) {
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
      variables: {
        sourceId: 'squad',
        input: { title: 'Node.js', section: 'Runtime' },
      },
    });
    expect(res.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('should require edit permission', async () => {
    loggedUser = '1';
    // Add user as regular member (no edit permission)
    await con.getRepository(SourceMember).save({
      userId: '1',
      sourceId: 'squad',
      role: SourceMemberRoles.Member,
      referralToken: 'token1',
    });

    const res = await client.mutate(MUTATION, {
      variables: {
        sourceId: 'squad',
        input: { title: 'Node.js', section: 'Runtime' },
      },
    });
    expect(res.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });

  it('should create stack item when user has edit permission', async () => {
    loggedUser = '1';
    // Add user as admin
    await con.getRepository(SourceMember).save({
      userId: '1',
      sourceId: 'squad',
      role: SourceMemberRoles.Admin,
      referralToken: 'token1',
    });

    const res = await client.mutate(MUTATION, {
      variables: {
        sourceId: 'squad',
        input: { title: 'Node.js', section: 'Runtime' },
      },
    });

    expect(res.errors).toBeUndefined();
    expect(res.data.addSourceStack.section).toBe('Runtime');
    expect(res.data.addSourceStack.tool.title).toBe('Node.js');

    const dataset = await con
      .getRepository(DatasetTool)
      .findOneBy({ titleNormalized: 'nodedotjs' });
    expect(dataset).not.toBeNull();
  });

  it('should prevent duplicate stack items', async () => {
    loggedUser = '1';
    await con.getRepository(SourceMember).save({
      userId: '1',
      sourceId: 'squad',
      role: SourceMemberRoles.Admin,
      referralToken: 'token1',
    });

    await client.mutate(MUTATION, {
      variables: {
        sourceId: 'squad',
        input: { title: 'Go', section: 'Languages' },
      },
    });

    const res = await client.mutate(MUTATION, {
      variables: {
        sourceId: 'squad',
        input: { title: 'Go', section: 'Languages' },
      },
    });

    expect(res.errors?.[0]?.message).toBe(
      'Stack item already exists in this Squad',
    );
  });

  it('should reject adding stack to non-squad sources', async () => {
    loggedUser = '1';
    // Source 'a' is a machine source
    const res = await client.mutate(MUTATION, {
      variables: {
        sourceId: 'a',
        input: { title: 'Node.js', section: 'Runtime' },
      },
    });

    expect(res.errors?.[0]?.message).toBe('Stack can only be added to Squads');
  });
});

describe('mutation updateSourceStack', () => {
  const MUTATION = `
    mutation UpdateSourceStack($id: ID!, $input: UpdateSourceStackInput!) {
      updateSourceStack(id: $id, input: $input) {
        id
        section
        title
      }
    }
  `;

  it('should allow creator to update their own item', async () => {
    loggedUser = '1';
    await con.getRepository(SourceMember).save({
      userId: '1',
      sourceId: 'squad',
      role: SourceMemberRoles.Member,
      referralToken: 'token1',
    });

    const tool = await con.getRepository(DatasetTool).save({
      title: 'Rust',
      titleNormalized: 'rust',
      faviconSource: 'none',
    });
    const sourceStack = await con.getRepository(SourceStack).save({
      sourceId: 'squad',
      toolId: tool.id,
      section: 'Languages',
      position: 0,
      createdById: '1',
    });

    const res = await client.mutate(MUTATION, {
      variables: {
        id: sourceStack.id,
        input: { section: 'Systems' },
      },
    });

    expect(res.errors).toBeUndefined();
    expect(res.data.updateSourceStack.section).toBe('Systems');
  });

  it('should allow admin to update any item', async () => {
    loggedUser = '2';
    await con.getRepository(SourceMember).save([
      {
        userId: '1',
        sourceId: 'squad',
        role: SourceMemberRoles.Member,
        referralToken: 'token1',
      },
      {
        userId: '2',
        sourceId: 'squad',
        role: SourceMemberRoles.Admin,
        referralToken: 'token2',
      },
    ]);

    const tool = await con.getRepository(DatasetTool).save({
      title: 'Rust',
      titleNormalized: 'rust',
      faviconSource: 'none',
    });
    const sourceStack = await con.getRepository(SourceStack).save({
      sourceId: 'squad',
      toolId: tool.id,
      section: 'Languages',
      position: 0,
      createdById: '1', // Created by user 1
    });

    // User 2 (admin) updates item created by user 1
    const res = await client.mutate(MUTATION, {
      variables: {
        id: sourceStack.id,
        input: { section: 'Updated' },
      },
    });

    expect(res.errors).toBeUndefined();
    expect(res.data.updateSourceStack.section).toBe('Updated');
  });

  it('should return error for non-existent item', async () => {
    loggedUser = '1';
    await con.getRepository(SourceMember).save({
      userId: '1',
      sourceId: 'squad',
      role: SourceMemberRoles.Admin,
      referralToken: 'token1',
    });

    const res = await client.mutate(MUTATION, {
      variables: {
        id: '00000000-0000-0000-0000-000000000000',
        input: { section: 'Test' },
      },
    });
    expect(res.errors?.[0]?.message).toBe('Stack item not found');
  });
});

describe('mutation deleteSourceStack', () => {
  const MUTATION = `
    mutation DeleteSourceStack($id: ID!) {
      deleteSourceStack(id: $id) {
        _
      }
    }
  `;

  it('should allow creator to delete their own item', async () => {
    loggedUser = '1';
    await con.getRepository(SourceMember).save({
      userId: '1',
      sourceId: 'squad',
      role: SourceMemberRoles.Member,
      referralToken: 'token1',
    });

    const tool = await con.getRepository(DatasetTool).save({
      title: 'Java',
      titleNormalized: 'java',
      faviconSource: 'none',
    });
    const sourceStack = await con.getRepository(SourceStack).save({
      sourceId: 'squad',
      toolId: tool.id,
      section: 'Languages',
      position: 0,
      createdById: '1',
    });

    await client.mutate(MUTATION, { variables: { id: sourceStack.id } });

    const deleted = await con
      .getRepository(SourceStack)
      .findOneBy({ id: sourceStack.id });
    expect(deleted).toBeNull();
  });

  it('should allow admin to delete any item', async () => {
    loggedUser = '2';
    await con.getRepository(SourceMember).save([
      {
        userId: '1',
        sourceId: 'squad',
        role: SourceMemberRoles.Member,
        referralToken: 'token1',
      },
      {
        userId: '2',
        sourceId: 'squad',
        role: SourceMemberRoles.Admin,
        referralToken: 'token2',
      },
    ]);

    const tool = await con.getRepository(DatasetTool).save({
      title: 'Java',
      titleNormalized: 'java',
      faviconSource: 'none',
    });
    const sourceStack = await con.getRepository(SourceStack).save({
      sourceId: 'squad',
      toolId: tool.id,
      section: 'Languages',
      position: 0,
      createdById: '1', // Created by user 1
    });

    // User 2 (admin) deletes item
    await client.mutate(MUTATION, { variables: { id: sourceStack.id } });

    const deleted = await con
      .getRepository(SourceStack)
      .findOneBy({ id: sourceStack.id });
    expect(deleted).toBeNull();
  });

  it('should prevent non-creator from deleting without edit permission', async () => {
    loggedUser = '2';
    await con.getRepository(SourceMember).save([
      {
        userId: '1',
        sourceId: 'squad',
        role: SourceMemberRoles.Member,
        referralToken: 'token1',
      },
      {
        userId: '2',
        sourceId: 'squad',
        role: SourceMemberRoles.Member,
        referralToken: 'token2',
      },
    ]);

    const tool = await con.getRepository(DatasetTool).save({
      title: 'Java',
      titleNormalized: 'java',
      faviconSource: 'none',
    });
    const sourceStack = await con.getRepository(SourceStack).save({
      sourceId: 'squad',
      toolId: tool.id,
      section: 'Languages',
      position: 0,
      createdById: '1', // Created by user 1
    });

    // User 2 (member) tries to delete item created by user 1
    const res = await client.mutate(MUTATION, {
      variables: { id: sourceStack.id },
    });
    expect(res.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });
});

describe('mutation reorderSourceStack', () => {
  const MUTATION = `
    mutation ReorderSourceStack($sourceId: ID!, $items: [ReorderSourceStackInput!]!) {
      reorderSourceStack(sourceId: $sourceId, items: $items) {
        id
        position
      }
    }
  `;

  it('should require edit permission', async () => {
    loggedUser = '1';
    await con.getRepository(SourceMember).save({
      userId: '1',
      sourceId: 'squad',
      role: SourceMemberRoles.Member,
      referralToken: 'token1',
    });

    const res = await client.mutate(MUTATION, {
      variables: {
        sourceId: 'squad',
        items: [{ id: '00000000-0000-0000-0000-000000000000', position: 0 }],
      },
    });
    expect(res.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });

  it('should update positions when admin', async () => {
    loggedUser = '1';
    await con.getRepository(SourceMember).save({
      userId: '1',
      sourceId: 'squad',
      role: SourceMemberRoles.Admin,
      referralToken: 'token1',
    });

    const stack1 = await con.getRepository(DatasetTool).save({
      title: 'CSS',
      titleNormalized: 'css',
    });
    const stack2 = await con.getRepository(DatasetTool).save({
      title: 'HTML',
      titleNormalized: 'html',
    });

    const [item1, item2] = await con.getRepository(SourceStack).save([
      {
        sourceId: 'squad',
        toolId: stack1.id,
        section: 'Web',
        position: 0,
        createdById: '1',
      },
      {
        sourceId: 'squad',
        toolId: stack2.id,
        section: 'Web',
        position: 1,
        createdById: '1',
      },
    ]);

    const res = await client.mutate(MUTATION, {
      variables: {
        sourceId: 'squad',
        items: [
          { id: item1.id, position: 1 },
          { id: item2.id, position: 0 },
        ],
      },
    });

    expect(res.errors).toBeUndefined();
    const reordered = res.data.reorderSourceStack;
    expect(
      reordered.find((i: { id: string }) => i.id === item1.id).position,
    ).toBe(1);
    expect(
      reordered.find((i: { id: string }) => i.id === item2.id).position,
    ).toBe(0);
  });
});
