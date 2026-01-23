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
import { UserHotTake } from '../src/entity/user/UserHotTake';
import { UserHotTakeUpvote } from '../src/entity/user/UserHotTakeUpvote';

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

describe('query userHotTakes', () => {
  const QUERY = `
    query UserHotTakes($userId: ID!) {
      userHotTakes(userId: $userId) {
        edges {
          node {
            id
            emoji
            title
            subtitle
            position
          }
        }
      }
    }
  `;

  it('should return empty list for user with no hot takes', async () => {
    const res = await client.query(QUERY, { variables: { userId: '1' } });
    expect(res.data.userHotTakes.edges).toEqual([]);
  });

  it('should return hot takes ordered by position', async () => {
    await con.getRepository(UserHotTake).save([
      { userId: '1', emoji: '🔥', title: 'Hot take 1', position: 1 },
      { userId: '1', emoji: '💡', title: 'Hot take 2', position: 0 },
    ]);

    const res = await client.query(QUERY, { variables: { userId: '1' } });
    expect(res.data.userHotTakes.edges).toHaveLength(2);
    expect(res.data.userHotTakes.edges[0].node.title).toBe('Hot take 2');
    expect(res.data.userHotTakes.edges[1].node.title).toBe('Hot take 1');
  });

  it('should return hot takes with subtitle', async () => {
    await con.getRepository(UserHotTake).save({
      userId: '1',
      emoji: '🎯',
      title: 'My opinion',
      subtitle: 'Some context',
      position: 0,
    });

    const res = await client.query(QUERY, { variables: { userId: '1' } });
    expect(res.data.userHotTakes.edges[0].node).toMatchObject({
      emoji: '🎯',
      title: 'My opinion',
      subtitle: 'Some context',
    });
  });
});

describe('query userHotTakes with upvotes', () => {
  const QUERY = `
    query UserHotTakes($userId: ID!) {
      userHotTakes(userId: $userId) {
        edges {
          node {
            id
            title
            upvotes
            upvoted
          }
        }
      }
    }
  `;

  it('should return upvotes count', async () => {
    const hotTake = await con.getRepository(UserHotTake).save({
      userId: '1',
      emoji: '🔥',
      title: 'Popular take',
      position: 0,
    });

    await con.getRepository(UserHotTakeUpvote).save([
      { hotTakeId: hotTake.id, userId: '2' },
      { hotTakeId: hotTake.id, userId: '3' },
    ]);

    const res = await client.query(QUERY, { variables: { userId: '1' } });
    expect(res.data.userHotTakes.edges[0].node.upvotes).toBe(2);
  });

  it('should return upvoted as null when not logged in', async () => {
    await con.getRepository(UserHotTake).save({
      userId: '1',
      emoji: '🔥',
      title: 'Take',
      position: 0,
    });

    const res = await client.query(QUERY, { variables: { userId: '1' } });
    expect(res.data.userHotTakes.edges[0].node.upvoted).toBeNull();
  });

  it('should return upvoted as true when user upvoted', async () => {
    loggedUser = '2';
    const hotTake = await con.getRepository(UserHotTake).save({
      userId: '1',
      emoji: '🔥',
      title: 'Take',
      position: 0,
    });

    await con.getRepository(UserHotTakeUpvote).save({
      hotTakeId: hotTake.id,
      userId: '2',
    });

    const res = await client.query(QUERY, { variables: { userId: '1' } });
    expect(res.data.userHotTakes.edges[0].node.upvoted).toBe(true);
  });

  it('should return upvoted as false when user has not upvoted', async () => {
    loggedUser = '2';
    await con.getRepository(UserHotTake).save({
      userId: '1',
      emoji: '🔥',
      title: 'Take',
      position: 0,
    });

    const res = await client.query(QUERY, { variables: { userId: '1' } });
    expect(res.data.userHotTakes.edges[0].node.upvoted).toBe(false);
  });
});

describe('mutation vote on hot take', () => {
  const MUTATION = `
    mutation Vote($id: ID!, $entity: UserVoteEntity!, $vote: Int!) {
      vote(id: $id, entity: $entity, vote: $vote) {
        _
      }
    }
  `;

  it('should require authentication', async () => {
    const res = await client.mutate(MUTATION, {
      variables: {
        id: '00000000-0000-0000-0000-000000000000',
        entity: 'hot_take',
        vote: 1,
      },
    });
    expect(res.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('should upvote a hot take', async () => {
    loggedUser = '2';
    const hotTake = await con.getRepository(UserHotTake).save({
      userId: '1',
      emoji: '🔥',
      title: 'Take',
      position: 0,
    });

    const res = await client.mutate(MUTATION, {
      variables: {
        id: hotTake.id,
        entity: 'hot_take',
        vote: 1,
      },
    });

    expect(res.errors).toBeUndefined();

    const upvote = await con.getRepository(UserHotTakeUpvote).findOneBy({
      hotTakeId: hotTake.id,
      userId: '2',
    });
    expect(upvote).not.toBeNull();
  });

  it('should remove upvote when voting with 0', async () => {
    loggedUser = '2';
    const hotTake = await con.getRepository(UserHotTake).save({
      userId: '1',
      emoji: '🔥',
      title: 'Take',
      position: 0,
    });

    await con.getRepository(UserHotTakeUpvote).save({
      hotTakeId: hotTake.id,
      userId: '2',
    });

    const res = await client.mutate(MUTATION, {
      variables: {
        id: hotTake.id,
        entity: 'hot_take',
        vote: 0,
      },
    });

    expect(res.errors).toBeUndefined();

    const upvote = await con.getRepository(UserHotTakeUpvote).findOneBy({
      hotTakeId: hotTake.id,
      userId: '2',
    });
    expect(upvote).toBeNull();
  });

  it('should not allow downvoting hot takes', async () => {
    loggedUser = '2';
    const hotTake = await con.getRepository(UserHotTake).save({
      userId: '1',
      emoji: '🔥',
      title: 'Take',
      position: 0,
    });

    const res = await client.mutate(MUTATION, {
      variables: {
        id: hotTake.id,
        entity: 'hot_take',
        vote: -1,
      },
    });

    expect(res.errors?.[0]?.message).toBe('Hot takes do not support downvotes');
  });

  it('should return error for non-existent hot take', async () => {
    loggedUser = '2';
    const res = await client.mutate(MUTATION, {
      variables: {
        id: '00000000-0000-0000-0000-000000000000',
        entity: 'hot_take',
        vote: 1,
      },
    });

    expect(res.errors).toBeDefined();
  });

  it('should allow upvoting same hot take only once', async () => {
    loggedUser = '2';
    const hotTake = await con.getRepository(UserHotTake).save({
      userId: '1',
      emoji: '🔥',
      title: 'Take',
      position: 0,
    });

    await client.mutate(MUTATION, {
      variables: {
        id: hotTake.id,
        entity: 'hot_take',
        vote: 1,
      },
    });

    const res = await client.mutate(MUTATION, {
      variables: {
        id: hotTake.id,
        entity: 'hot_take',
        vote: 1,
      },
    });

    expect(res.errors).toBeUndefined();

    const upvotes = await con.getRepository(UserHotTakeUpvote).findBy({
      hotTakeId: hotTake.id,
      userId: '2',
    });
    expect(upvotes).toHaveLength(1);
  });
});

describe('mutation addUserHotTake', () => {
  const MUTATION = `
    mutation AddUserHotTake($input: AddUserHotTakeInput!) {
      addUserHotTake(input: $input) {
        id
        emoji
        title
        subtitle
        position
      }
    }
  `;

  it('should require authentication', async () => {
    const res = await client.mutate(MUTATION, {
      variables: { input: { emoji: '🔥', title: 'Hot take' } },
    });
    expect(res.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('should create hot take', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: { input: { emoji: '🔥', title: 'Hot take' } },
    });

    expect(res.errors).toBeUndefined();
    expect(res.data.addUserHotTake).toMatchObject({
      emoji: '🔥',
      title: 'Hot take',
      subtitle: null,
    });
  });

  it('should create hot take with subtitle', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: {
        input: { emoji: '💡', title: 'Idea', subtitle: 'Explanation' },
      },
    });

    expect(res.data.addUserHotTake).toMatchObject({
      emoji: '💡',
      title: 'Idea',
      subtitle: 'Explanation',
    });
  });

  it('should enforce maximum of 5 hot takes', async () => {
    loggedUser = '1';
    await con.getRepository(UserHotTake).save([
      { userId: '1', emoji: '1️⃣', title: 'Take 1', position: 0 },
      { userId: '1', emoji: '2️⃣', title: 'Take 2', position: 1 },
      { userId: '1', emoji: '3️⃣', title: 'Take 3', position: 2 },
      { userId: '1', emoji: '4️⃣', title: 'Take 4', position: 3 },
      { userId: '1', emoji: '5️⃣', title: 'Take 5', position: 4 },
    ]);

    const res = await client.mutate(MUTATION, {
      variables: { input: { emoji: '6️⃣', title: 'Take 6' } },
    });

    expect(res.errors?.[0]?.message).toBe('Maximum of 5 hot takes allowed');
  });
});

describe('mutation updateUserHotTake', () => {
  const MUTATION = `
    mutation UpdateUserHotTake($id: ID!, $input: UpdateUserHotTakeInput!) {
      updateUserHotTake(id: $id, input: $input) {
        id
        emoji
        title
        subtitle
      }
    }
  `;

  it('should require authentication', async () => {
    const res = await client.mutate(MUTATION, {
      variables: {
        id: '00000000-0000-0000-0000-000000000000',
        input: { title: 'Updated' },
      },
    });
    expect(res.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('should update hot take', async () => {
    loggedUser = '1';
    const hotTake = await con.getRepository(UserHotTake).save({
      userId: '1',
      emoji: '🔥',
      title: 'Original',
      position: 0,
    });

    const res = await client.mutate(MUTATION, {
      variables: {
        id: hotTake.id,
        input: { title: 'Updated', emoji: '💯' },
      },
    });

    expect(res.errors).toBeUndefined();
    expect(res.data.updateUserHotTake).toMatchObject({
      emoji: '💯',
      title: 'Updated',
    });
  });

  it('should update subtitle', async () => {
    loggedUser = '1';
    const hotTake = await con.getRepository(UserHotTake).save({
      userId: '1',
      emoji: '🔥',
      title: 'Hot take',
      position: 0,
    });

    const res = await client.mutate(MUTATION, {
      variables: {
        id: hotTake.id,
        input: { subtitle: 'New context' },
      },
    });

    expect(res.data.updateUserHotTake.subtitle).toBe('New context');
  });

  it('should return error for non-existent item', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: {
        id: '00000000-0000-0000-0000-000000000000',
        input: { title: 'Test' },
      },
    });
    expect(res.errors?.[0]?.message).toBe('Hot take not found');
  });

  it('should not allow updating other user hot take', async () => {
    loggedUser = '1';
    const hotTake = await con.getRepository(UserHotTake).save({
      userId: '2',
      emoji: '🔥',
      title: 'Other user take',
      position: 0,
    });

    const res = await client.mutate(MUTATION, {
      variables: {
        id: hotTake.id,
        input: { title: 'Hacked' },
      },
    });
    expect(res.errors?.[0]?.message).toBe('Hot take not found');
  });
});

describe('mutation deleteUserHotTake', () => {
  const MUTATION = `
    mutation DeleteUserHotTake($id: ID!) {
      deleteUserHotTake(id: $id) {
        _
      }
    }
  `;

  it('should require authentication', async () => {
    const res = await client.mutate(MUTATION, {
      variables: { id: '00000000-0000-0000-0000-000000000000' },
    });
    expect(res.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('should delete hot take', async () => {
    loggedUser = '1';
    const hotTake = await con.getRepository(UserHotTake).save({
      userId: '1',
      emoji: '🔥',
      title: 'To delete',
      position: 0,
    });

    await client.mutate(MUTATION, { variables: { id: hotTake.id } });

    const deleted = await con
      .getRepository(UserHotTake)
      .findOneBy({ id: hotTake.id });
    expect(deleted).toBeNull();
  });

  it('should not delete other user hot take', async () => {
    loggedUser = '1';
    const hotTake = await con.getRepository(UserHotTake).save({
      userId: '2',
      emoji: '🔥',
      title: 'Other user take',
      position: 0,
    });

    await client.mutate(MUTATION, { variables: { id: hotTake.id } });

    const notDeleted = await con
      .getRepository(UserHotTake)
      .findOneBy({ id: hotTake.id });
    expect(notDeleted).not.toBeNull();
  });
});

describe('mutation reorderUserHotTakes', () => {
  const MUTATION = `
    mutation ReorderUserHotTakes($items: [ReorderUserHotTakeInput!]!) {
      reorderUserHotTakes(items: $items) {
        id
        position
      }
    }
  `;

  it('should require authentication', async () => {
    const res = await client.mutate(MUTATION, {
      variables: { items: [] },
    });
    expect(res.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('should update positions', async () => {
    loggedUser = '1';
    const [item1, item2] = await con.getRepository(UserHotTake).save([
      { userId: '1', emoji: '1️⃣', title: 'Take 1', position: 0 },
      { userId: '1', emoji: '2️⃣', title: 'Take 2', position: 1 },
    ]);

    const res = await client.mutate(MUTATION, {
      variables: {
        items: [
          { id: item1.id, position: 1 },
          { id: item2.id, position: 0 },
        ],
      },
    });

    const reordered = res.data.reorderUserHotTakes;
    expect(
      reordered.find((i: { id: string }) => i.id === item1.id).position,
    ).toBe(1);
    expect(
      reordered.find((i: { id: string }) => i.id === item2.id).position,
    ).toBe(0);
  });

  it('should not reorder other user hot takes', async () => {
    loggedUser = '1';
    const otherUserItem = await con.getRepository(UserHotTake).save({
      userId: '2',
      emoji: '🔥',
      title: 'Other user',
      position: 0,
    });

    await client.mutate(MUTATION, {
      variables: {
        items: [{ id: otherUserItem.id, position: 5 }],
      },
    });

    const notUpdated = await con
      .getRepository(UserHotTake)
      .findOneBy({ id: otherUserItem.id });
    expect(notUpdated?.position).toBe(0);
  });
});
