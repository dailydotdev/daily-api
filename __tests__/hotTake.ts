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
import { HotTake } from '../src/entity/user/HotTake';
import { UserHotTake } from '../src/entity/user/UserHotTake';
import { UserVote } from '../src/types';

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

describe('query discoverHotTakes', () => {
  const QUERY = `
    query DiscoverHotTakes($first: Int) {
      discoverHotTakes(first: $first) {
        id
        emoji
        title
        subtitle
        upvotes
        upvoted
        user {
          id
          name
          username
          image
          reputation
        }
      }
    }
  `;

  it('should require authentication', async () => {
    const res = await client.query(QUERY);
    expect(res.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('should return hot takes from other users with user info', async () => {
    loggedUser = '1';
    await con.getRepository(HotTake).save([
      { userId: '2', emoji: '🔥', title: 'Take from user 2', position: 0 },
      { userId: '3', emoji: '💡', title: 'Take from user 3', position: 0 },
    ]);

    const res = await client.query(QUERY);
    expect(res.errors).toBeUndefined();
    expect(res.data.discoverHotTakes.length).toBeGreaterThanOrEqual(2);

    const titles = res.data.discoverHotTakes.map(
      (t: { title: string }) => t.title,
    );
    expect(titles).toContain('Take from user 2');
    expect(titles).toContain('Take from user 3');

    const take = res.data.discoverHotTakes.find(
      (t: { title: string }) => t.title === 'Take from user 2',
    );
    expect(take.user).toBeDefined();
    expect(take.user.id).toBe('2');
    expect(take.user.name).toBe('Tsahi');
    expect(take.user.username).toBe('tsahidaily');
  });

  it('should exclude current user own hot takes', async () => {
    loggedUser = '1';
    await con.getRepository(HotTake).save([
      { userId: '1', emoji: '🔥', title: 'My own take', position: 0 },
      { userId: '2', emoji: '💡', title: 'Other take', position: 0 },
    ]);

    const res = await client.query(QUERY);
    expect(res.errors).toBeUndefined();

    const titles = res.data.discoverHotTakes.map(
      (t: { title: string }) => t.title,
    );
    expect(titles).not.toContain('My own take');
    expect(titles).toContain('Other take');
  });

  it('should exclude already voted hot takes', async () => {
    loggedUser = '1';
    const hotTake1 = await con.getRepository(HotTake).save({
      userId: '2',
      emoji: '🔥',
      title: 'Already voted',
      position: 0,
    });
    await con.getRepository(HotTake).save({
      userId: '2',
      emoji: '💡',
      title: 'Not voted yet',
      position: 1,
    });

    await con.getRepository(UserHotTake).save({
      hotTakeId: hotTake1.id,
      userId: '1',
      vote: UserVote.Up,
    });

    const res = await client.query(QUERY);
    expect(res.errors).toBeUndefined();

    const titles = res.data.discoverHotTakes.map(
      (t: { title: string }) => t.title,
    );
    expect(titles).not.toContain('Already voted');
    expect(titles).toContain('Not voted yet');
  });

  it('should respect first limit', async () => {
    loggedUser = '1';
    await con.getRepository(HotTake).save([
      { userId: '2', emoji: '1️⃣', title: 'Take 1', position: 0 },
      { userId: '2', emoji: '2️⃣', title: 'Take 2', position: 1 },
      { userId: '2', emoji: '3️⃣', title: 'Take 3', position: 2 },
    ]);

    const res = await client.query(QUERY, { variables: { first: 2 } });
    expect(res.errors).toBeUndefined();
    expect(res.data.discoverHotTakes).toHaveLength(2);
  });

  it('should return empty array when no takes available', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY);
    expect(res.errors).toBeUndefined();
    expect(res.data.discoverHotTakes).toEqual([]);
  });

  it('should exclude takes where user has any vote record', async () => {
    loggedUser = '1';
    const hotTake1 = await con.getRepository(HotTake).save({
      userId: '2',
      emoji: '🔥',
      title: 'Skipped take',
      position: 0,
    });
    await con.getRepository(HotTake).save({
      userId: '2',
      emoji: '💡',
      title: 'Fresh take',
      position: 1,
    });

    // Record with vote=None (user saw it but didn't upvote)
    await con.getRepository(UserHotTake).save({
      hotTakeId: hotTake1.id,
      userId: '1',
      vote: UserVote.None,
    });

    const res = await client.query(QUERY);
    const titles = res.data.discoverHotTakes.map(
      (t: { title: string }) => t.title,
    );
    expect(titles).not.toContain('Skipped take');
    expect(titles).toContain('Fresh take');
  });
});

describe('query hotTakes', () => {
  const QUERY = `
    query HotTakes($userId: ID!) {
      hotTakes(userId: $userId) {
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
    expect(res.data.hotTakes.edges).toEqual([]);
  });

  it('should return hot takes ordered by position', async () => {
    await con.getRepository(HotTake).save([
      { userId: '1', emoji: '🔥', title: 'Hot take 1', position: 1 },
      { userId: '1', emoji: '💡', title: 'Hot take 2', position: 0 },
    ]);

    const res = await client.query(QUERY, { variables: { userId: '1' } });
    expect(res.data.hotTakes.edges).toHaveLength(2);
    expect(res.data.hotTakes.edges[0].node.title).toBe('Hot take 2');
    expect(res.data.hotTakes.edges[1].node.title).toBe('Hot take 1');
  });

  it('should return hot takes with subtitle', async () => {
    await con.getRepository(HotTake).save({
      userId: '1',
      emoji: '🎯',
      title: 'My opinion',
      subtitle: 'Some context',
      position: 0,
    });

    const res = await client.query(QUERY, { variables: { userId: '1' } });
    expect(res.data.hotTakes.edges[0].node).toMatchObject({
      emoji: '🎯',
      title: 'My opinion',
      subtitle: 'Some context',
    });
  });
});

describe('query hotTakes with upvotes', () => {
  const QUERY = `
    query HotTakes($userId: ID!) {
      hotTakes(userId: $userId) {
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
    const hotTake = await con.getRepository(HotTake).save({
      userId: '1',
      emoji: '🔥',
      title: 'Popular take',
      position: 0,
    });

    await con.getRepository(UserHotTake).save([
      { hotTakeId: hotTake.id, userId: '2', vote: UserVote.Up },
      { hotTakeId: hotTake.id, userId: '3', vote: UserVote.Up },
    ]);

    const res = await client.query(QUERY, { variables: { userId: '1' } });
    expect(res.data.hotTakes.edges[0].node.upvotes).toBe(2);
  });

  it('should return upvoted as null when not logged in', async () => {
    await con.getRepository(HotTake).save({
      userId: '1',
      emoji: '🔥',
      title: 'Take',
      position: 0,
    });

    const res = await client.query(QUERY, { variables: { userId: '1' } });
    expect(res.data.hotTakes.edges[0].node.upvoted).toBeNull();
  });

  it('should return upvoted as true when user upvoted', async () => {
    loggedUser = '2';
    const hotTake = await con.getRepository(HotTake).save({
      userId: '1',
      emoji: '🔥',
      title: 'Take',
      position: 0,
    });

    await con.getRepository(UserHotTake).save({
      hotTakeId: hotTake.id,
      userId: '2',
      vote: UserVote.Up,
    });

    const res = await client.query(QUERY, { variables: { userId: '1' } });
    expect(res.data.hotTakes.edges[0].node.upvoted).toBe(true);
  });

  it('should return upvoted as false when user has not upvoted', async () => {
    loggedUser = '2';
    await con.getRepository(HotTake).save({
      userId: '1',
      emoji: '🔥',
      title: 'Take',
      position: 0,
    });

    const res = await client.query(QUERY, { variables: { userId: '1' } });
    expect(res.data.hotTakes.edges[0].node.upvoted).toBe(false);
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
    const hotTake = await con.getRepository(HotTake).save({
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

    const userHotTake = await con.getRepository(UserHotTake).findOneBy({
      hotTakeId: hotTake.id,
      userId: '2',
    });
    expect(userHotTake).not.toBeNull();
    expect(userHotTake?.vote).toBe(UserVote.Up);
  });

  it('should remove upvote when voting with 0', async () => {
    loggedUser = '2';
    const hotTake = await con.getRepository(HotTake).save({
      userId: '1',
      emoji: '🔥',
      title: 'Take',
      position: 0,
    });

    await con.getRepository(UserHotTake).save({
      hotTakeId: hotTake.id,
      userId: '2',
      vote: UserVote.Up,
    });

    const res = await client.mutate(MUTATION, {
      variables: {
        id: hotTake.id,
        entity: 'hot_take',
        vote: 0,
      },
    });

    expect(res.errors).toBeUndefined();

    const userHotTake = await con.getRepository(UserHotTake).findOneBy({
      hotTakeId: hotTake.id,
      userId: '2',
    });
    expect(userHotTake?.vote).toBe(UserVote.None);
  });

  it('should allow downvoting hot takes', async () => {
    loggedUser = '2';
    const hotTake = await con.getRepository(HotTake).save({
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

    expect(res.errors).toBeUndefined();

    const userHotTake = await con.getRepository(UserHotTake).findOneBy({
      hotTakeId: hotTake.id,
      userId: '2',
    });
    expect(userHotTake?.vote).toBe(UserVote.Down);
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
    const hotTake = await con.getRepository(HotTake).save({
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

    const upvotes = await con.getRepository(UserHotTake).findBy({
      hotTakeId: hotTake.id,
      userId: '2',
    });
    expect(upvotes).toHaveLength(1);
  });
});

describe('mutation addHotTake', () => {
  const MUTATION = `
    mutation AddHotTake($input: AddHotTakeInput!) {
      addHotTake(input: $input) {
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
    expect(res.data.addHotTake).toMatchObject({
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

    expect(res.data.addHotTake).toMatchObject({
      emoji: '💡',
      title: 'Idea',
      subtitle: 'Explanation',
    });
  });

  it('should enforce maximum of 5 hot takes', async () => {
    loggedUser = '1';
    await con.getRepository(HotTake).save([
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

describe('mutation updateHotTake', () => {
  const MUTATION = `
    mutation UpdateHotTake($id: ID!, $input: UpdateHotTakeInput!) {
      updateHotTake(id: $id, input: $input) {
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
    const hotTake = await con.getRepository(HotTake).save({
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
    expect(res.data.updateHotTake).toMatchObject({
      emoji: '💯',
      title: 'Updated',
    });
  });

  it('should update subtitle', async () => {
    loggedUser = '1';
    const hotTake = await con.getRepository(HotTake).save({
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

    expect(res.data.updateHotTake.subtitle).toBe('New context');
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
    const hotTake = await con.getRepository(HotTake).save({
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

describe('mutation deleteHotTake', () => {
  const MUTATION = `
    mutation DeleteHotTake($id: ID!) {
      deleteHotTake(id: $id) {
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
    const hotTake = await con.getRepository(HotTake).save({
      userId: '1',
      emoji: '🔥',
      title: 'To delete',
      position: 0,
    });

    await client.mutate(MUTATION, { variables: { id: hotTake.id } });

    const deleted = await con
      .getRepository(HotTake)
      .findOneBy({ id: hotTake.id });
    expect(deleted).toBeNull();
  });

  it('should not delete other user hot take', async () => {
    loggedUser = '1';
    const hotTake = await con.getRepository(HotTake).save({
      userId: '2',
      emoji: '🔥',
      title: 'Other user take',
      position: 0,
    });

    await client.mutate(MUTATION, { variables: { id: hotTake.id } });

    const notDeleted = await con
      .getRepository(HotTake)
      .findOneBy({ id: hotTake.id });
    expect(notDeleted).not.toBeNull();
  });
});

describe('mutation reorderHotTakes', () => {
  const MUTATION = `
    mutation ReorderHotTakes($items: [ReorderHotTakeInput!]!) {
      reorderHotTakes(items: $items) {
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
    const [item1, item2] = await con.getRepository(HotTake).save([
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

    const reordered = res.data.reorderHotTakes;
    expect(
      reordered.find((i: { id: string }) => i.id === item1.id).position,
    ).toBe(1);
    expect(
      reordered.find((i: { id: string }) => i.id === item2.id).position,
    ).toBe(0);
  });

  it('should not reorder other user hot takes', async () => {
    loggedUser = '1';
    const otherUserItem = await con.getRepository(HotTake).save({
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
      .getRepository(HotTake)
      .findOneBy({ id: otherUserItem.id });
    expect(notUpdated?.position).toBe(0);
  });
});
