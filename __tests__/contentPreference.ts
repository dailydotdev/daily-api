import nock from 'nock';

import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  testQueryErrorCode,
} from './helpers';

import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import { Context } from '../src/Context';
import { User } from '../src/entity/user/User';
import { usersFixture } from './fixture/user';
import { ContentPreferenceUser } from '../src/entity/contentPreference/ContentPreferenceUser';
import {
  ContentPreferenceStatus,
  ContentPreferenceType,
} from '../src/entity/contentPreference/types';
import { NotificationPreferenceUser } from '../src/entity/notifications/NotificationPreferenceUser';

let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string | undefined;

jest.mock('../src/common/mailing.ts', () => ({
  ...(jest.requireActual('../src/common/mailing.ts') as Record<
    string,
    unknown
  >),
  sendEmail: jest.fn(),
}));

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser) as Context,
  );
  client = state.client;
});

beforeEach(async () => {
  loggedUser = undefined;
  nock.cleanAll();
  jest.clearAllMocks();
});

afterAll(() => disposeGraphQLTesting(state));

describe('query userFollowers', () => {
  const QUERY = `query UserFollowers($id: ID!, $entity: ContentPreferenceType!) {
    userFollowers(userId: $id, entity: $entity) {
      edges {
        node {
          user {
            id
          }
          referenceId
          status
        }
      }
    }
  }`;

  beforeEach(async () => {
    await saveFixtures(
      con,
      User,
      usersFixture.map((item) => {
        return {
          ...item,
          id: `${item.id}-ufq`,
          username: `${item.username}-ufq`,
        };
      }),
    );

    await con.getRepository(ContentPreferenceUser).save([
      {
        userId: '2-ufq',
        referenceId: '1-ufq',
        referenceUserId: '1-ufq',
        status: ContentPreferenceStatus.Follow,
      },
      {
        userId: '3-ufq',
        referenceId: '1-ufq',
        referenceUserId: '1-ufq',
        status: ContentPreferenceStatus.Subscribed,
      },
      {
        userId: '1-ufq',
        referenceId: '2-ufq',
        referenceUserId: '2-ufq',
        status: ContentPreferenceStatus.Follow,
      },
      {
        userId: '4-ufq',
        referenceId: '1-ufq',
        referenceUserId: '1-ufq',
        status: ContentPreferenceStatus.Follow,
      },
    ]);
  });

  it('should return list of user followers', async () => {
    const res = await client.query(QUERY, {
      variables: {
        id: '1-ufq',
        entity: ContentPreferenceType.User,
      },
    });

    expect(res.errors).toBeFalsy();

    expect(res.data).toEqual({
      userFollowers: {
        edges: [
          {
            node: {
              referenceId: '1-ufq',
              status: 'follow',
              user: {
                id: '2-ufq',
              },
            },
          },
          {
            node: {
              referenceId: '1-ufq',
              status: 'subscribed',
              user: {
                id: '3-ufq',
              },
            },
          },
          {
            node: {
              referenceId: '1-ufq',
              status: 'follow',
              user: {
                id: '4-ufq',
              },
            },
          },
        ],
      },
    });
  });

  it('should return empty list when user has no followers', async () => {
    await con.getRepository(ContentPreferenceUser).delete({});

    const res = await client.query(QUERY, {
      variables: {
        id: '1-ufq',
        entity: ContentPreferenceType.User,
      },
    });

    expect(res.errors).toBeFalsy();

    expect(res.data.userFollowers.edges).toHaveLength(0);
    expect(res.data).toEqual({
      userFollowers: {
        edges: [],
      },
    });
  });
});

describe('query userFollowing', () => {
  const QUERY = `query UserFollowing($id: ID!, $entity: ContentPreferenceType!) {
    userFollowing(userId: $id, entity: $entity) {
      edges {
        node {
          user {
            id
          }
          referenceId
          status
        }
      }
    }
  }`;

  beforeEach(async () => {
    await saveFixtures(
      con,
      User,
      usersFixture.map((item) => {
        return {
          ...item,
          id: `${item.id}-ufwq`,
          username: `${item.username}-ufwq`,
        };
      }),
    );

    await con.getRepository(ContentPreferenceUser).save([
      {
        userId: '1-ufwq',
        referenceId: '2-ufwq',
        referenceUserId: '2-ufwq',
        status: ContentPreferenceStatus.Follow,
      },
      {
        userId: '1-ufwq',
        referenceId: '3-ufwq',
        referenceUserId: '3-ufwq',
        status: ContentPreferenceStatus.Subscribed,
      },
      {
        userId: '2-ufwq',
        referenceId: '1-ufwq',
        referenceUserId: '1-ufwq',
        status: ContentPreferenceStatus.Follow,
      },
      {
        userId: '1-ufwq',
        referenceId: '4-ufwq',
        referenceUserId: '4-ufwq',
        status: ContentPreferenceStatus.Follow,
      },
    ]);
  });

  it('should return list of users user is following', async () => {
    const res = await client.query(QUERY, {
      variables: {
        id: '1-ufwq',
        entity: ContentPreferenceType.User,
      },
    });

    expect(res.errors).toBeFalsy();

    expect(res.data).toEqual({
      userFollowing: {
        edges: [
          {
            node: {
              referenceId: '2-ufwq',
              status: 'follow',
              user: {
                id: '1-ufwq',
              },
            },
          },
          {
            node: {
              referenceId: '3-ufwq',
              status: 'subscribed',
              user: {
                id: '1-ufwq',
              },
            },
          },
          {
            node: {
              referenceId: '4-ufwq',
              status: 'follow',
              user: {
                id: '1-ufwq',
              },
            },
          },
        ],
      },
    });
  });

  it('should return empty list when user is not following anyone', async () => {
    await con.getRepository(ContentPreferenceUser).delete({});

    const res = await client.query(QUERY, {
      variables: {
        id: '1-ufwq',
        entity: ContentPreferenceType.User,
      },
    });

    expect(res.errors).toBeFalsy();

    expect(res.data.userFollowing.edges).toHaveLength(0);
    expect(res.data).toEqual({
      userFollowing: {
        edges: [],
      },
    });
  });
});

describe('query ContentPreferenceStatus', () => {
  const QUERY = `query ContentPreferenceStatus($id: ID!, $entity: ContentPreferenceType!) {
    contentPreferenceStatus(id: $id, entity: $entity) {
      referenceId
      status
    }
  }`;

  beforeEach(async () => {
    await saveFixtures(
      con,
      User,
      usersFixture.map((item) => {
        return {
          ...item,
          id: `${item.id}-cpsq`,
          username: `${item.username}-cpsq`,
        };
      }),
    );

    await con.getRepository(ContentPreferenceUser).save([
      {
        userId: '1-cpsq',
        referenceId: '2-cpsq',
        referenceUserId: '2-cpsq',
        status: ContentPreferenceStatus.Follow,
      },
      {
        userId: '1-cpsq',
        referenceId: '3-cpsq',
        referenceUserId: '3-cpsq',
        status: ContentPreferenceStatus.Subscribed,
      },
      {
        userId: '2-cpsq',
        referenceId: '1-cpsq',
        referenceUserId: '1-cpsq',
        status: ContentPreferenceStatus.Follow,
      },
    ]);
  });

  it('should return status for content preference', async () => {
    loggedUser = '1-cpsq';

    const res = await client.query(QUERY, {
      variables: {
        id: '2-cpsq',
        entity: ContentPreferenceType.User,
      },
    });

    expect(res.errors).toBeFalsy();

    expect(res.data).toEqual({
      contentPreferenceStatus: {
        referenceId: '2-cpsq',
        status: ContentPreferenceStatus.Follow,
      },
    });
  });

  it('should return not found when content preference does not exist', async () => {
    loggedUser = '1-cpsq';

    await testQueryErrorCode(
      client,
      {
        query: QUERY,
        variables: {
          id: '4-cpsq',
          entity: ContentPreferenceType.User,
        },
      },
      'NOT_FOUND',
    );
  });

  it('should require authentication', async () => {
    await testQueryErrorCode(
      client,
      {
        query: QUERY,
        variables: {
          id: '3-cpsq',
          entity: ContentPreferenceType.User,
        },
      },
      'UNAUTHENTICATED',
    );
  });

  it('should error if user is not found', async () => {
    loggedUser = '1-cpsq';

    await testQueryErrorCode(
      client,
      {
        query: QUERY,
        variables: {
          id: '16-cpsq',
          entity: ContentPreferenceType.User,
        },
      },
      'NOT_FOUND',
    );
  });
});

describe('mutation follow', () => {
  const MUTATION = `mutation Follow($id: ID!, $entity: ContentPreferenceType!, $status: FollowStatus!) {
    follow(id: $id, entity: $entity, status: $status) {
      _
    }
  }`;

  beforeEach(async () => {
    await saveFixtures(
      con,
      User,
      usersFixture.map((item) => {
        return {
          ...item,
          id: `${item.id}-fm`,
          username: `${item.username}-fm`,
        };
      }),
    );
  });

  it('should follow user', async () => {
    loggedUser = '1-fm';

    const res = await client.query(MUTATION, {
      variables: {
        id: '3-fm',
        entity: ContentPreferenceType.User,
        status: ContentPreferenceStatus.Follow,
      },
    });

    expect(res.errors).toBeFalsy();

    const contentPreference = await con
      .getRepository(ContentPreferenceUser)
      .findOneBy({
        userId: '1-fm',
        referenceId: '3-fm',
      });

    expect(contentPreference).not.toBeNull();
    expect(contentPreference!.status).toBe(ContentPreferenceStatus.Follow);

    const notificationPreferences = await con
      .getRepository(NotificationPreferenceUser)
      .findBy({
        userId: '1-fm',
        referenceUserId: '3-fm',
      });

    expect(notificationPreferences).toHaveLength(0);
  });

  it('should subscribe to user', async () => {
    loggedUser = '1-fm';

    const res = await client.query(MUTATION, {
      variables: {
        id: '2-fm',
        entity: ContentPreferenceType.User,
        status: ContentPreferenceStatus.Subscribed,
      },
    });

    expect(res.errors).toBeFalsy();

    const contentPreference = await con
      .getRepository(ContentPreferenceUser)
      .findOneBy({
        userId: '1-fm',
        referenceId: '2-fm',
      });

    expect(contentPreference).not.toBeNull();
    expect(contentPreference?.status).toBe(ContentPreferenceStatus.Subscribed);

    const notificationPreferences = await con
      .getRepository(NotificationPreferenceUser)
      .findBy({
        userId: '1-fm',
        referenceUserId: '2-fm',
      });

    expect(notificationPreferences).toHaveLength(1);
  });
});

describe('mutation unfollow', () => {
  const MUTATION = `mutation Unfollow($id: ID!, $entity: ContentPreferenceType!) {
    unfollow(id: $id, entity: $entity) {
      _
    }
  }`;

  beforeEach(async () => {
    await saveFixtures(
      con,
      User,
      usersFixture.map((item) => {
        return {
          ...item,
          id: `${item.id}-um`,
          username: `${item.username}-um`,
        };
      }),
    );

    await con.getRepository(ContentPreferenceUser).save([
      {
        userId: '1-um',
        referenceId: '2-um',
        referenceUserId: '2-um',
        status: ContentPreferenceStatus.Follow,
      },
      {
        userId: '1-um',
        referenceId: '3-um',
        referenceUserId: '3-um',
        status: ContentPreferenceStatus.Subscribed,
      },
      {
        userId: '2-um',
        referenceId: '1-um',
        referenceUserId: '1-um',
        status: ContentPreferenceStatus.Follow,
      },
    ]);
  });

  it('should unfollow user', async () => {
    loggedUser = '1-um';

    const res = await client.query(MUTATION, {
      variables: {
        id: '2-um',
        entity: ContentPreferenceType.User,
      },
    });

    expect(res.errors).toBeFalsy();

    const contentPreference = await con
      .getRepository(ContentPreferenceUser)
      .findOneBy({
        userId: '1-um',
        referenceId: '2-um',
      });

    expect(contentPreference).toBeNull();

    const notificationPreferences = await con
      .getRepository(NotificationPreferenceUser)
      .findBy({
        userId: '1-um',
        referenceUserId: '2-um',
      });

    expect(notificationPreferences).toHaveLength(0);
  });

  it('should do nothing if user is not following', async () => {
    loggedUser = '1-um';

    const res = await client.query(MUTATION, {
      variables: {
        id: '3-um',
        entity: ContentPreferenceType.User,
      },
    });

    expect(res.errors).toBeFalsy();

    const contentPreference = await con
      .getRepository(ContentPreferenceUser)
      .findOneBy({
        userId: '1-um',
        referenceId: '3-um',
      });

    expect(contentPreference).toBeNull();

    const notificationPreferences = await con
      .getRepository(NotificationPreferenceUser)
      .findBy({
        userId: '1-um',
        referenceUserId: '3-um',
      });

    expect(notificationPreferences).toHaveLength(0);
  });
});

describe('query contentPreferenceStatus', () => {
  const QUERY = `query ContentPreferenceStatus($id: ID!, $entity: ContentPreferenceType!) {
    contentPreferenceStatus(id: $id, entity: $entity) {
      user {
        id
      }
      referenceId
      status
    }
  }`;

  beforeEach(async () => {
    await saveFixtures(
      con,
      User,
      usersFixture.map((item) => {
        return {
          ...item,
          id: `${item.id}-cps`,
          username: `${item.username}-cps`,
        };
      }),
    );

    await con.getRepository(ContentPreferenceUser).save([
      {
        userId: '1-cps',
        status: ContentPreferenceStatus.Follow,
        referenceId: '2-cps',
        referenceUserId: '2-cps',
      },
      {
        userId: '1-cps',
        status: ContentPreferenceStatus.Follow,
        referenceId: '3-cps',
        referenceUserId: '3-cps',
      },
    ]);
  });

  it('should return content preference for user', async () => {
    loggedUser = '1-cps';

    const res = await client.query(QUERY, {
      variables: { id: '2-cps', entity: ContentPreferenceType.User },
    });

    expect(res.errors).toBeFalsy();

    expect(res.data.contentPreferenceStatus).toMatchObject({
      referenceId: '2-cps',
      status: 'follow',
    });

    const res2 = await client.query(QUERY, {
      variables: { id: '3-cps', entity: ContentPreferenceType.User },
    });

    expect(res2.errors).toBeFalsy();

    expect(res2.data.contentPreferenceStatus).toMatchObject({
      referenceId: '3-cps',
      status: 'follow',
    });
  });

  it('should return null if content preference does not exist', async () => {
    loggedUser = '1-cps';

    await testQueryErrorCode(
      client,
      {
        query: QUERY,
        variables: { id: '4-cps', entity: ContentPreferenceType.User },
      },
      'NOT_FOUND',
    );
  });

  it('should require authentication', async () => {
    await testQueryErrorCode(
      client,
      {
        query: QUERY,
        variables: { id: '2-cps', entity: ContentPreferenceType.User },
      },
      'UNAUTHENTICATED',
    );
  });
});
