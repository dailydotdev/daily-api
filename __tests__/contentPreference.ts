import nock from 'nock';

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
import {
  Feed,
  FeedSource,
  FeedTag,
  Keyword,
  Source,
  SourceType,
} from '../src/entity';
import { ContentPreferenceSource } from '../src/entity/contentPreference/ContentPreferenceSource';
import {
  NotificationPreferenceStatus,
  NotificationType,
} from '../src/notifications/common';
import { ghostUser } from '../src/common';
import { ContentPreferenceKeyword } from '../src/entity/contentPreference/ContentPreferenceKeyword';
import { ContentPreferenceWord } from '../src/entity/contentPreference/ContentPreferenceWord';

let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string | undefined;
let isPlus: boolean;

jest.mock('../src/common/mailing.ts', () => ({
  ...(jest.requireActual('../src/common/mailing.ts') as Record<
    string,
    unknown
  >),
  sendEmail: jest.fn(),
}));

jest.mock('../src/common/constants.ts', () => ({
  ...(jest.requireActual('../src/common/constants.ts') as Record<
    string,
    unknown
  >),
  MAX_FOLLOWERS_LIMIT: 10,
}));

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser, [], null, false, isPlus) as Context,
  );
  client = state.client;
});

beforeEach(async () => {
  loggedUser = undefined;
  isPlus = false;
  nock.cleanAll();
  jest.clearAllMocks();
});

afterAll(() => disposeGraphQLTesting(state));

describe('query userBlocked', () => {
  const QUERY = `query UserBlocked($entity: ContentPreferenceType!) {
    userBlocked(entity: $entity) {
      edges {
        node {
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
          id: `${item.id}-uwb`,
          username: `${item.username}-uwb`,
        };
      }),
    );

    await saveFixtures(
      con,
      Feed,
      usersFixture.map((item) => ({
        id: `${item.id}-uwb`,
        userId: `${item.id}-uwb`,
      })),
    );

    const now = new Date();

    await con.getRepository(ContentPreferenceWord).save([
      {
        userId: '1-uwb',
        feedId: '1-uwb',
        referenceId: 'word-1-uwb',
        status: ContentPreferenceStatus.Blocked,
        createdAt: new Date(now.getTime() - 1000),
      },
      {
        userId: '1-uwb',
        feedId: '1-uwb',
        referenceId: 'word-2-uwb',
        status: ContentPreferenceStatus.Blocked,
        createdAt: new Date(now.getTime() - 2000),
      },
    ]);
  });

  it('should require authentication', async () => {
    await testQueryErrorCode(
      client,
      {
        query: QUERY,
        variables: {
          entity: ContentPreferenceType.Word,
        },
      },
      'UNAUTHENTICATED',
    );
  });

  it('should return list of blocked words', async () => {
    loggedUser = '1-uwb';
    const res = await client.query(QUERY, {
      variables: {
        entity: ContentPreferenceType.Word,
      },
    });

    expect(res.errors).toBeFalsy();

    expect(res.data).toEqual({
      userBlocked: {
        edges: [
          {
            node: {
              referenceId: 'word-1-uwb',
              status: 'blocked',
            },
          },
          {
            node: {
              referenceId: 'word-2-uwb',
              status: 'blocked',
            },
          },
        ],
      },
    });
  });
});

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

    await saveFixtures(
      con,
      Feed,
      usersFixture.map((item) => ({
        id: `${item.id}-ufq`,
        userId: `${item.id}-ufq`,
      })),
    );

    const now = new Date();

    await con.getRepository(ContentPreferenceUser).save([
      {
        userId: '2-ufq',
        feedId: '2-ufq',
        referenceId: '1-ufq',
        referenceUserId: '1-ufq',
        status: ContentPreferenceStatus.Follow,
        createdAt: new Date(now.getTime() - 1000),
      },
      {
        userId: '3-ufq',
        feedId: '3-ufq',
        referenceId: '1-ufq',
        referenceUserId: '1-ufq',
        status: ContentPreferenceStatus.Subscribed,
        createdAt: new Date(now.getTime() - 2000),
      },
      {
        userId: '1-ufq',
        feedId: '1-ufq',
        referenceId: '2-ufq',
        referenceUserId: '2-ufq',
        status: ContentPreferenceStatus.Follow,
        createdAt: new Date(now.getTime() - 3000),
      },
      {
        userId: '4-ufq',
        feedId: '4-ufq',
        referenceId: '1-ufq',
        referenceUserId: '1-ufq',
        status: ContentPreferenceStatus.Follow,
        createdAt: new Date(now.getTime() - 4000),
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
  const QUERY = `query UserFollowing($id: ID!, $entity: ContentPreferenceType!, $feedId: String) {
    userFollowing(userId: $id, entity: $entity, feedId: $feedId) {
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

    await saveFixtures(
      con,
      Feed,
      usersFixture.map((item) => ({
        id: `${item.id}-ufwq`,
        userId: `${item.id}-ufwq`,
      })),
    );

    const now = new Date();

    await con.getRepository(ContentPreferenceUser).save([
      {
        userId: '1-ufwq',
        feedId: '1-ufwq',
        referenceId: '2-ufwq',
        referenceUserId: '2-ufwq',
        status: ContentPreferenceStatus.Follow,
        createdAt: new Date(now.getTime() - 1000),
      },
      {
        userId: '1-ufwq',
        feedId: '1-ufwq',
        referenceId: '3-ufwq',
        referenceUserId: '3-ufwq',
        status: ContentPreferenceStatus.Subscribed,
        createdAt: new Date(now.getTime() - 2000),
      },
      {
        userId: '2-ufwq',
        feedId: '2-ufwq',
        referenceId: '1-ufwq',
        referenceUserId: '1-ufwq',
        status: ContentPreferenceStatus.Follow,
        createdAt: new Date(now.getTime() - 3000),
      },
      {
        userId: '1-ufwq',
        feedId: '1-ufwq',
        referenceId: '4-ufwq',
        referenceUserId: '4-ufwq',
        status: ContentPreferenceStatus.Follow,
        createdAt: new Date(now.getTime() - 4000),
      },
    ]);
  });

  it('should return list of users user is following on main feed', async () => {
    const res = await client.query(QUERY, {
      variables: {
        id: '1-ufwq',
        entity: ContentPreferenceType.User,
        feedId: '1-ufwq',
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

  it('should return list of users user is following on main feed without feedId', async () => {
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

  it('should return list of users user is following on custom feed', async () => {
    await con.getRepository(Feed).save({
      id: '5-ufwq',
      userId: '1-ufwq',
    });
    const now = new Date();
    await con.getRepository(ContentPreferenceUser).save([
      {
        userId: '1-ufwq',
        feedId: '5-ufwq',
        referenceId: '2-ufwq',
        referenceUserId: '2-ufwq',
        status: ContentPreferenceStatus.Follow,
        createdAt: new Date(now.getTime() - 1000),
      },
    ]);

    const res = await client.query(QUERY, {
      variables: {
        id: '1-ufwq',
        entity: ContentPreferenceType.User,
        feedId: '5-ufwq',
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

    await saveFixtures(
      con,
      Feed,
      usersFixture.map((item) => ({
        id: `${item.id}-cpsq`,
        userId: `${item.id}-cpsq`,
      })),
    );

    await con.getRepository(ContentPreferenceUser).save([
      {
        userId: '1-cpsq',
        feedId: '1-cpsq',
        referenceId: '2-cpsq',
        referenceUserId: '2-cpsq',
        status: ContentPreferenceStatus.Follow,
      },
      {
        userId: '1-cpsq',
        feedId: '1-cpsq',
        referenceId: '3-cpsq',
        referenceUserId: '3-cpsq',
        status: ContentPreferenceStatus.Subscribed,
      },
      {
        userId: '2-cpsq',
        feedId: '2-cpsq',
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
  const MUTATION = `mutation Follow($id: ID!, $entity: ContentPreferenceType!, $status: FollowStatus!, $feedId: String) {
    follow(id: $id, entity: $entity, status: $status, feedId: $feedId) {
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

    await saveFixtures(
      con,
      Feed,
      usersFixture.map((item) => ({
        id: `${item.id}-fm`,
        userId: `${item.id}-fm`,
      })),
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

  it('should not follow on custom feed if not plus member', async () => {
    loggedUser = '1-fm';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          id: '1-fm',
          entity: ContentPreferenceType.User,
          status: ContentPreferenceStatus.Follow,
          feedId: '2-fm',
        },
      },
      'UNAUTHENTICATED',
    );
  });

  it('should follow user on custom feed', async () => {
    loggedUser = '1-fm';
    isPlus = true;

    await con.getRepository(Feed).save({
      id: '5-fm',
      userId: '1-fm',
    });

    const res = await client.query(MUTATION, {
      variables: {
        id: '3-fm',
        entity: ContentPreferenceType.User,
        status: ContentPreferenceStatus.Follow,
        feedId: '5-fm',
      },
    });

    expect(res.errors).toBeFalsy();

    const contentPreference = await con
      .getRepository(ContentPreferenceUser)
      .findOneBy({
        userId: '1-fm',
        referenceId: '3-fm',
        feedId: '5-fm',
      });

    expect(contentPreference).not.toBeNull();
    expect(contentPreference!.status).toBe(ContentPreferenceStatus.Follow);
    expect(contentPreference!.feedId).toEqual('5-fm');

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
  });

  it('should subscribe when already following', async () => {
    loggedUser = '1-fm';

    const resFollow = await client.query(MUTATION, {
      variables: {
        id: '2-fm',
        entity: ContentPreferenceType.User,
        status: ContentPreferenceStatus.Follow,
      },
    });

    expect(resFollow.errors).toBeFalsy();

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
  });

  it('should not follow yourself', async () => {
    loggedUser = '1-fm';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          id: '1-fm',
          entity: ContentPreferenceType.User,
          status: ContentPreferenceStatus.Follow,
        },
      },
      'CONFLICT',
    );
  });

  it('should not subscribe to yourself', async () => {
    loggedUser = '1-fm';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          id: '1-fm',
          entity: ContentPreferenceType.User,
          status: ContentPreferenceStatus.Subscribed,
        },
      },
      'CONFLICT',
    );
  });

  it('should not follow ghost user', async () => {
    loggedUser = '1-fm';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          id: ghostUser.id,
          entity: ContentPreferenceType.User,
          status: ContentPreferenceStatus.Follow,
        },
      },
      'CONFLICT',
    );
  });

  it('should not subscribe to ghost user', async () => {
    loggedUser = '1-fm';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          id: ghostUser.id,
          entity: ContentPreferenceType.User,
          status: ContentPreferenceStatus.Subscribed,
        },
      },
      'CONFLICT',
    );
  });

  describe('keyword', () => {
    beforeEach(async () => {
      await saveFixtures(con, Keyword, [
        { value: 'keyword-f1', occurrences: 300, status: 'allow' },
        { value: 'keyword-f2', occurrences: 200, status: 'allow' },
        { value: 'keyword-f3', occurrences: 100, status: 'allow' },
      ]);

      await saveFixtures(con, Feed, [{ id: '1-fm', userId: '1-fm' }]);
    });

    it('should follow', async () => {
      loggedUser = '1-fm';

      const res = await client.query(MUTATION, {
        variables: {
          id: 'keyword-f1',
          entity: ContentPreferenceType.Keyword,
          status: ContentPreferenceStatus.Follow,
        },
      });

      expect(res.errors).toBeFalsy();

      const contentPreference = await con
        .getRepository(ContentPreferenceKeyword)
        .findOneBy({
          userId: '1-fm',
          referenceId: 'keyword-f1',
        });

      expect(contentPreference).not.toBeNull();
      expect(contentPreference!.status).toBe(ContentPreferenceStatus.Follow);
    });

    it('should not follow on custom feed if not plus member', async () => {
      loggedUser = '1-fm';

      await testMutationErrorCode(
        client,
        {
          mutation: MUTATION,
          variables: {
            id: 'keyword-f1',
            entity: ContentPreferenceType.Keyword,
            status: ContentPreferenceStatus.Follow,
            feedId: '2-fm',
          },
        },
        'UNAUTHENTICATED',
      );
    });

    it('should follow user on custom feed', async () => {
      loggedUser = '1-fm';
      isPlus = true;

      await con.getRepository(Feed).save({
        id: '5-fm',
        userId: '1-fm',
      });

      const res = await client.query(MUTATION, {
        variables: {
          id: 'keyword-f1',
          entity: ContentPreferenceType.Keyword,
          status: ContentPreferenceStatus.Follow,
          feedId: '5-fm',
        },
      });

      expect(res.errors).toBeFalsy();

      const contentPreference = await con
        .getRepository(ContentPreferenceKeyword)
        .findOneBy({
          userId: '1-fm',
          referenceId: 'keyword-f1',
          feedId: '5-fm',
        });

      expect(contentPreference).not.toBeNull();
      expect(contentPreference!.status).toBe(ContentPreferenceStatus.Follow);
      expect(contentPreference!.feedId).toEqual('5-fm');
    });

    it('should subscribe when already following', async () => {
      loggedUser = '1-fm';

      const resFollow = await client.query(MUTATION, {
        variables: {
          id: 'keyword-f1',
          entity: ContentPreferenceType.Keyword,
          status: ContentPreferenceStatus.Follow,
        },
      });

      expect(resFollow.errors).toBeFalsy();

      const res = await client.query(MUTATION, {
        variables: {
          id: 'keyword-f1',
          entity: ContentPreferenceType.Keyword,
          status: ContentPreferenceStatus.Subscribed,
        },
      });

      expect(res.errors).toBeFalsy();

      const contentPreference = await con
        .getRepository(ContentPreferenceKeyword)
        .findOneBy({
          userId: '1-fm',
          referenceId: 'keyword-f1',
        });

      expect(contentPreference).not.toBeNull();
      expect(contentPreference?.status).toBe(
        ContentPreferenceStatus.Subscribed,
      );
    });
  });

  describe('source', () => {
    beforeEach(async () => {
      await saveFixtures(con, Source, [
        {
          id: 'a-fm',
          name: 'A-fm',
          image: 'http://image.com/a-fm',
          handle: 'a-fm',
          type: SourceType.Machine,
        },
      ]);

      await saveFixtures(con, Feed, [{ id: '1-fm', userId: '1-fm' }]);
    });

    it('should follow', async () => {
      loggedUser = '1-fm';

      const res = await client.query(MUTATION, {
        variables: {
          id: 'a-fm',
          entity: ContentPreferenceType.Source,
          status: ContentPreferenceStatus.Follow,
        },
      });

      expect(res.errors).toBeFalsy();

      const contentPreference = await con
        .getRepository(ContentPreferenceSource)
        .findOneBy({
          userId: '1-fm',
          referenceId: 'a-fm',
        });

      expect(contentPreference).not.toBeNull();
      expect(contentPreference!.status).toBe(ContentPreferenceStatus.Follow);
      expect(contentPreference!.flags.referralToken).not.toBeNull();

      const feedSource = await con.getRepository(FeedSource).findOneBy({
        feedId: '1-fm',
        sourceId: 'a-fm',
      });
      expect(feedSource).not.toBeNull();
      expect(feedSource!.blocked).toBe(false);
    });

    it('should not follow on custom feed if not plus member', async () => {
      loggedUser = '1-fm';

      await testMutationErrorCode(
        client,
        {
          mutation: MUTATION,
          variables: {
            id: 'a-fm',
            entity: ContentPreferenceType.Source,
            status: ContentPreferenceStatus.Follow,
            feedId: '2-fm',
          },
        },
        'UNAUTHENTICATED',
      );
    });

    it('should follow user on custom feed', async () => {
      loggedUser = '1-fm';
      isPlus = true;

      await con.getRepository(Feed).save({
        id: '5-fm',
        userId: '1-fm',
      });

      const res = await client.query(MUTATION, {
        variables: {
          id: 'a-fm',
          entity: ContentPreferenceType.Source,
          status: ContentPreferenceStatus.Follow,
          feedId: '5-fm',
        },
      });

      expect(res.errors).toBeFalsy();

      const contentPreference = await con
        .getRepository(ContentPreferenceSource)
        .findOneBy({
          userId: '1-fm',
          referenceId: 'a-fm',
          feedId: '5-fm',
        });

      expect(contentPreference).not.toBeNull();
      expect(contentPreference!.status).toBe(ContentPreferenceStatus.Follow);
      expect(contentPreference!.feedId).toEqual('5-fm');
    });

    it('should subscribe', async () => {
      loggedUser = '1-fm';

      const res = await client.query(MUTATION, {
        variables: {
          id: 'a-fm',
          entity: ContentPreferenceType.Source,
          status: ContentPreferenceStatus.Subscribed,
        },
      });

      expect(res.errors).toBeFalsy();

      const contentPreference = await con
        .getRepository(ContentPreferenceSource)
        .findOneBy({
          userId: '1-fm',
          referenceId: 'a-fm',
        });

      expect(contentPreference).not.toBeNull();
      expect(contentPreference?.status).toBe(
        ContentPreferenceStatus.Subscribed,
      );

      const feedSource = await con.getRepository(FeedSource).findOneBy({
        feedId: '1-fm',
        sourceId: 'a-fm',
      });
      expect(feedSource).not.toBeNull();
      expect(feedSource!.blocked).toBe(false);
    });

    it('should subscribe when already following', async () => {
      loggedUser = '1-fm';

      const resFollow = await client.query(MUTATION, {
        variables: {
          id: 'a-fm',
          entity: ContentPreferenceType.Source,
          status: ContentPreferenceStatus.Follow,
        },
      });

      expect(resFollow.errors).toBeFalsy();

      const res = await client.query(MUTATION, {
        variables: {
          id: 'a-fm',
          entity: ContentPreferenceType.Source,
          status: ContentPreferenceStatus.Subscribed,
        },
      });

      expect(res.errors).toBeFalsy();

      const contentPreference = await con
        .getRepository(ContentPreferenceSource)
        .findOneBy({
          userId: '1-fm',
          referenceId: 'a-fm',
        });

      expect(contentPreference).not.toBeNull();
      expect(contentPreference?.status).toBe(
        ContentPreferenceStatus.Subscribed,
      );
    });

    it('should not overwrite referralToken if preference already exists', async () => {
      loggedUser = '1-fm';

      const res = await client.query(MUTATION, {
        variables: {
          id: 'a-fm',
          entity: ContentPreferenceType.Source,
          status: ContentPreferenceStatus.Follow,
        },
      });

      expect(res.errors).toBeFalsy();

      const contentPreferenceBefore = await con
        .getRepository(ContentPreferenceSource)
        .findOneBy({
          userId: '1-fm',
          referenceId: 'a-fm',
        });

      expect(contentPreferenceBefore).not.toBeNull();

      const res2 = await client.query(MUTATION, {
        variables: {
          id: 'a-fm',
          entity: ContentPreferenceType.Source,
          status: ContentPreferenceStatus.Subscribed,
        },
      });

      expect(res2.errors).toBeFalsy();

      const contentPreferenceAfter = await con
        .getRepository(ContentPreferenceSource)
        .findOneBy({
          userId: '1-fm',
          referenceId: 'a-fm',
        });

      expect(contentPreferenceBefore!.flags.referralToken).toBe(
        contentPreferenceAfter!.flags.referralToken,
      );
    });
  });

  it('should not follow user if limit is reached', async () => {
    loggedUser = '1-fm';

    await saveFixtures(
      con,
      User,
      new Array(15).fill(null).map((item, index) => {
        return {
          id: `${index}-fml`,
          username: `${index}-fml`,
          email: `fml${index}@daily.dev`,
        };
      }),
    );

    await con.getRepository(ContentPreferenceUser).save([
      ...new Array(5).fill(null).map((item, index) => {
        const id = index;

        return {
          userId: '1-fm',
          feedId: '1-fm',
          referenceId: `${id}-fml`,
          referenceUserId: `${id}-fml`,
          status: ContentPreferenceStatus.Follow,
          type: ContentPreferenceType.User,
        };
      }),
      ...new Array(5).fill(null).map((item, index) => {
        const id = index + 5;

        return {
          userId: '1-fm',
          feedId: '1-fm',
          referenceId: `${id}-fml`,
          referenceUserId: `${id}-fml`,
          status: ContentPreferenceStatus.Subscribed,
          type: ContentPreferenceType.User,
        };
      }),
    ]);

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          id: '2-fm',
          entity: ContentPreferenceType.User,
          status: ContentPreferenceStatus.Follow,
        },
      },
      'CONFLICT',
    );
  });
});

describe('mutation unfollow', () => {
  const MUTATION = `mutation Unfollow($id: ID!, $entity: ContentPreferenceType!, $feedId: String) {
    unfollow(id: $id, entity: $entity, feedId: $feedId) {
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

    await saveFixtures(
      con,
      Feed,
      usersFixture.map((item) => ({
        id: `${item.id}-um`,
        userId: `${item.id}-um`,
      })),
    );

    await con.getRepository(ContentPreferenceUser).save([
      {
        userId: '1-um',
        feedId: '1-um',
        referenceId: '2-um',
        referenceUserId: '2-um',
        status: ContentPreferenceStatus.Follow,
      },
      {
        userId: '1-um',
        feedId: '1-um',
        referenceId: '3-um',
        referenceUserId: '3-um',
        status: ContentPreferenceStatus.Subscribed,
      },
      {
        userId: '2-um',
        feedId: '2-um',
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

  it('should not unfollow on custom feed if not plus member', async () => {
    loggedUser = '1-fm';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          id: '2-um',
          entity: ContentPreferenceType.User,
          feedId: '2-fm',
        },
      },
      'UNAUTHENTICATED',
    );
  });

  it('should unfollow user on custom feed', async () => {
    loggedUser = '1-um';
    isPlus = true;

    await con.getRepository(Feed).save({
      id: '5-um',
      userId: '1-um',
    });

    await con.getRepository(ContentPreferenceUser).save([
      {
        userId: '1-um',
        feedId: '5-um',
        referenceId: '2-um',
        referenceUserId: '2-um',
        status: ContentPreferenceStatus.Follow,
      },
    ]);

    const res = await client.query(MUTATION, {
      variables: {
        id: '2-um',
        entity: ContentPreferenceType.User,
        feedId: '5-um',
      },
    });

    expect(res.errors).toBeFalsy();

    const contentPreference = await con
      .getRepository(ContentPreferenceUser)
      .findOneBy({
        userId: '1-um',
        referenceId: '2-um',
        feedId: '5-um',
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

  it('should remove notification preferences', async () => {
    loggedUser = '1-um';

    await con.getRepository(NotificationPreferenceUser).save([
      {
        userId: '1-um',
        referenceUserId: '2-um',
        referenceId: '2-um',
        status: NotificationPreferenceStatus.Subscribed,
        notificationType: NotificationType.UserPostAdded,
      },
    ]);

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

  it('should not remove muted notification preferences', async () => {
    loggedUser = '1-um';

    await con.getRepository(NotificationPreferenceUser).save([
      {
        userId: '1-um',
        referenceUserId: '2-um',
        referenceId: '2-um',
        status: NotificationPreferenceStatus.Muted,
        notificationType: NotificationType.UserPostAdded,
      },
    ]);

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

    expect(notificationPreferences).toHaveLength(1);
  });

  describe('keyword', () => {
    beforeEach(async () => {
      await saveFixtures(con, Keyword, [
        { value: 'keyword-uf1', occurrences: 300, status: 'allow' },
        { value: 'keyword-uf2', occurrences: 200, status: 'allow' },
        { value: 'keyword-uf3', occurrences: 100, status: 'allow' },
      ]);

      await saveFixtures(con, Feed, [{ id: '1-um', userId: '1-um' }]);

      await con.getRepository(ContentPreferenceKeyword).save([
        {
          userId: '1-um',
          referenceId: 'keyword-uf1',
          feedId: '1-um',
          status: ContentPreferenceStatus.Follow,
        },
        {
          userId: '2-um',
          referenceId: 'keyword-uf2',
          feedId: '1-um',
          status: ContentPreferenceStatus.Follow,
        },
      ]);
    });

    it('should unfollow', async () => {
      loggedUser = '1-um';

      const res = await client.query(MUTATION, {
        variables: {
          id: '2-um',
          entity: ContentPreferenceType.Keyword,
        },
      });

      expect(res.errors).toBeFalsy();

      const contentPreference = await con
        .getRepository(ContentPreferenceKeyword)
        .findOneBy({
          userId: '1-um',
          referenceId: 'keyword-f1',
        });

      expect(contentPreference).toBeNull();

      const feedSource = await con.getRepository(FeedSource).findOneBy({
        feedId: '1-fm',
        sourceId: 'a-fm',
      });
      expect(feedSource).toBeNull();
    });
  });

  describe('source', () => {
    beforeEach(async () => {
      await saveFixtures(con, Source, [
        {
          id: 'a-ufm',
          name: 'A-ufm',
          image: 'http://image.com/a-ufm',
          handle: 'a-ufm',
          type: SourceType.Machine,
        },
      ]);

      await saveFixtures(con, Feed, [{ id: '1-um', userId: '1-um' }]);

      await con.getRepository(ContentPreferenceSource).save([
        {
          userId: '1-um',
          referenceId: 'a-ufm',
          feedId: '1-um',
          status: ContentPreferenceStatus.Follow,
          sourceId: 'a-ufm',
        },
      ]);

      await con.getRepository(FeedSource).save([
        {
          feedId: '1-um',
          sourceId: 'a-ufm',
          blocked: false,
        },
      ]);
    });

    it('should unfollow', async () => {
      loggedUser = '1-um';

      const res = await client.query(MUTATION, {
        variables: {
          id: 'a-ufm',
          entity: ContentPreferenceType.Source,
        },
      });

      expect(res.errors).toBeFalsy();

      const contentPreference = await con
        .getRepository(ContentPreferenceSource)
        .findOneBy({
          userId: '1-um',
          referenceId: 'a-ufm',
        });

      expect(contentPreference).toBeNull();

      const feedSource = await con.getRepository(FeedSource).findOneBy({
        feedId: '1-um',
        sourceId: 'a-ufm',
      });
      expect(feedSource).toBeNull();
    });
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

    await saveFixtures(
      con,
      Feed,
      usersFixture.map((item) => ({
        id: `${item.id}-cps`,
        userId: `${item.id}-cps`,
      })),
    );

    await await con.getRepository(ContentPreferenceUser).save([
      {
        userId: '1-cps',
        feedId: '1-cps',
        status: ContentPreferenceStatus.Follow,
        referenceId: '2-cps',
        referenceUserId: '2-cps',
      },
      {
        userId: '1-cps',
        feedId: '1-cps',
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

describe('mutation block', () => {
  const MUTATION = `mutation Block($id: ID!, $entity: ContentPreferenceType!) {
    block(id: $id, entity: $entity) {
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
          id: `${item.id}-blm`,
          username: `${item.username}-blm`,
        };
      }),
    );

    await saveFixtures(
      con,
      Feed,
      usersFixture.map((item) => ({
        id: `${item.id}-blm`,
        userId: `${item.id}-blm`,
      })),
    );
  });

  it('should block user', async () => {
    loggedUser = '1-blm';

    const res = await client.query(MUTATION, {
      variables: {
        id: '3-blm',
        entity: ContentPreferenceType.User,
      },
    });

    expect(res.errors).toBeFalsy();

    const contentPreference = await con
      .getRepository(ContentPreferenceUser)
      .findOneBy({
        userId: '1-blm',
        referenceId: '3-blm',
      });

    expect(contentPreference).not.toBeNull();
    expect(contentPreference!.status).toBe(ContentPreferenceStatus.Blocked);

    const notificationPreferences = await con
      .getRepository(NotificationPreferenceUser)
      .findBy({
        userId: '1-blm',
        referenceUserId: '3-blm',
      });

    expect(notificationPreferences).toHaveLength(0);
  });

  it('should not block yourself', async () => {
    loggedUser = '1-blm';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          id: '1-blm',
          entity: ContentPreferenceType.User,
        },
      },
      'CONFLICT',
    );
  });

  it('should not block ghost user', async () => {
    loggedUser = '1-blm';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          id: ghostUser.id,
          entity: ContentPreferenceType.User,
        },
      },
      'CONFLICT',
    );
  });

  describe('keyword', () => {
    beforeEach(async () => {
      await saveFixtures(con, Keyword, [
        { value: 'keyword-bl1', occurrences: 300, status: 'allow' },
        { value: 'keyword-bl2', occurrences: 200, status: 'allow' },
        { value: 'keyword-bl3', occurrences: 100, status: 'allow' },
      ]);

      await saveFixtures(con, Feed, [{ id: '1-blm', userId: '1-blm' }]);
    });

    it('should block', async () => {
      loggedUser = '1-blm';

      const res = await client.query(MUTATION, {
        variables: {
          id: 'keyword-bl1',
          entity: ContentPreferenceType.Keyword,
        },
      });

      expect(res.errors).toBeFalsy();

      const contentPreference = await con
        .getRepository(ContentPreferenceKeyword)
        .findOneBy({
          userId: '1-blm',
          referenceId: 'keyword-bl1',
        });

      expect(contentPreference).not.toBeNull();
      expect(contentPreference!.status).toBe(ContentPreferenceStatus.Blocked);

      const feedTag = await con.getRepository(FeedTag).findOneBy({
        feedId: loggedUser,
        tag: 'keyword-bl1',
        blocked: true,
      });

      expect(feedTag).not.toBeNull();
      expect(feedTag!.blocked).toBe(true);
    });
  });

  describe('word', () => {
    beforeEach(async () => {
      await saveFixtures(con, Feed, [{ id: '1-blm', userId: '1-blm' }]);
    });

    it('should block', async () => {
      loggedUser = '1-blm';

      const res = await client.query(MUTATION, {
        variables: {
          id: 'word-bl1',
          entity: ContentPreferenceType.Word,
        },
      });

      expect(res.errors).toBeFalsy();

      const contentPreference = await con
        .getRepository(ContentPreferenceWord)
        .findOneBy({
          userId: '1-blm',
          referenceId: 'word-bl1',
        });

      expect(contentPreference).not.toBeNull();
      expect(contentPreference!.type).toEqual(ContentPreferenceType.Word);
      expect(contentPreference!.status).toBe(ContentPreferenceStatus.Blocked);
    });

    it('should block multiple words', async () => {
      loggedUser = '1-blm';

      const res = await client.query(MUTATION, {
        variables: {
          id: 'word-bl1,   word-bl2,  word-bl3   ,',
          entity: ContentPreferenceType.Word,
        },
      });

      expect(res.errors).toBeFalsy();

      const contentPreferences = await con
        .getRepository(ContentPreferenceWord)
        .findBy({
          type: ContentPreferenceType.Word,
        });

      expect(contentPreferences).not.toBeNull();
      expect(contentPreferences.length).toBe(3);

      contentPreferences.forEach((cp) => {
        expect(cp.status).toBe(ContentPreferenceStatus.Blocked);
        expect(cp.type).toEqual(ContentPreferenceType.Word);
        expect(['word-bl1', 'word-bl2', 'word-bl3']).toContain(cp.referenceId);
      });
    });

    it('should block multiple words', async () => {
      loggedUser = '1-blm';

      const res = await client.query(MUTATION, {
        variables: {
          id: 'word-bl1,   word-bl2,  word-bl3   ,',
          entity: ContentPreferenceType.Word,
        },
      });

      expect(res.errors).toBeFalsy();

      const contentPreferences = await con
        .getRepository(ContentPreferenceWord)
        .findBy({
          type: ContentPreferenceType.Word,
        });

      expect(contentPreferences).not.toBeNull();
      expect(contentPreferences.length).toBe(3);

      contentPreferences.forEach((cp) => {
        expect(cp.status).toBe(ContentPreferenceStatus.Blocked);
        expect(cp.type).toEqual(ContentPreferenceType.Word);
        expect(['word-bl1', 'word-bl2', 'word-bl3']).toContain(cp.referenceId);
      });
    });

    it('should block multiple words and store lowercased', async () => {
      loggedUser = '1-blm';

      const res = await client.query(MUTATION, {
        variables: {
          id: 'wOrD-bL1,   Word-bL2,  word-BL3   ,',
          entity: ContentPreferenceType.Word,
        },
      });

      expect(res.errors).toBeFalsy();

      const contentPreferences = await con
        .getRepository(ContentPreferenceWord)
        .findBy({
          type: ContentPreferenceType.Word,
        });

      expect(contentPreferences).not.toBeNull();
      expect(contentPreferences.length).toBe(3);

      contentPreferences.forEach((cp) => {
        expect(cp.status).toBe(ContentPreferenceStatus.Blocked);
        expect(cp.type).toEqual(ContentPreferenceType.Word);
        expect(['word-bl1', 'word-bl2', 'word-bl3']).toContain(cp.referenceId);
      });
    });
  });

  describe('source', () => {
    beforeEach(async () => {
      await saveFixtures(con, Source, [
        {
          id: 'a-blm',
          name: 'A-blm',
          image: 'http://image.com/a-fm',
          handle: 'a-blm',
          type: SourceType.Machine,
        },
      ]);

      await saveFixtures(con, Feed, [{ id: '1-blm', userId: '1-blm' }]);
    });

    it('should block', async () => {
      loggedUser = '1-blm';

      const res = await client.query(MUTATION, {
        variables: {
          id: 'a-blm',
          entity: ContentPreferenceType.Source,
        },
      });

      expect(res.errors).toBeFalsy();

      const contentPreference = await con
        .getRepository(ContentPreferenceSource)
        .findOneBy({
          userId: '1-blm',
          referenceId: 'a-blm',
        });

      expect(contentPreference).not.toBeNull();
      expect(contentPreference!.status).toBe(ContentPreferenceStatus.Blocked);

      const feedSource = await con.getRepository(FeedSource).findOneBy({
        feedId: '1-blm',
        sourceId: 'a-blm',
      });
      expect(feedSource).not.toBeNull();
      expect(feedSource!.blocked).toBe(true);
    });

    it('should not overwrite referralToken if preference already exists', async () => {
      loggedUser = '1-blm';

      const res = await client.query(MUTATION, {
        variables: {
          id: 'a-blm',
          entity: ContentPreferenceType.Source,
        },
      });

      expect(res.errors).toBeFalsy();

      const contentPreferenceBefore = await con
        .getRepository(ContentPreferenceSource)
        .findOneBy({
          userId: '1-blm',
          referenceId: 'a-blm',
        });

      expect(contentPreferenceBefore).not.toBeNull();

      const res2 = await client.query(MUTATION, {
        variables: {
          id: 'a-blm',
          entity: ContentPreferenceType.Source,
        },
      });

      expect(res2.errors).toBeFalsy();

      const contentPreferenceAfter = await con
        .getRepository(ContentPreferenceSource)
        .findOneBy({
          userId: '1-blm',
          referenceId: 'a-blm',
        });

      expect(contentPreferenceBefore!.flags.referralToken).toBe(
        contentPreferenceAfter!.flags.referralToken,
      );
    });
  });
});

describe('mutation unblock', () => {
  const MUTATION = `mutation Unblock($id: ID!, $entity: ContentPreferenceType!) {
    unblock(id: $id, entity: $entity) {
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
          id: `${item.id}-ublm`,
          username: `${item.username}-ublm`,
        };
      }),
    );

    await saveFixtures(
      con,
      Feed,
      usersFixture.map((item) => ({
        id: `${item.id}-ublm`,
        userId: `${item.id}-ublm`,
      })),
    );

    await con.getRepository(ContentPreferenceUser).save([
      {
        userId: '1-ublm',
        feedId: '1-ublm',
        referenceId: '2-ublm',
        referenceUserId: '2-ublm',
        status: ContentPreferenceStatus.Blocked,
      },
      {
        userId: '2-ublm',
        feedId: '2-ublm',
        referenceId: '1-ublm',
        referenceUserId: '1-ublm',
        status: ContentPreferenceStatus.Blocked,
      },
    ]);
  });

  it('should unblock user', async () => {
    loggedUser = '1-ublm';

    const res = await client.query(MUTATION, {
      variables: {
        id: '2-ublm',
        entity: ContentPreferenceType.User,
      },
    });

    expect(res.errors).toBeFalsy();

    const contentPreference = await con
      .getRepository(ContentPreferenceUser)
      .findOneBy({
        userId: '1-ublm',
        referenceId: '2-ublm',
      });

    expect(contentPreference).toBeNull();

    const notificationPreferences = await con
      .getRepository(NotificationPreferenceUser)
      .findBy({
        userId: '1-ublm',
        referenceUserId: '2-ublm',
      });

    expect(notificationPreferences).toHaveLength(0);
  });

  it('should do nothing if user is not blocked', async () => {
    loggedUser = '1-ublm';

    const res = await client.query(MUTATION, {
      variables: {
        id: '3-ublm',
        entity: ContentPreferenceType.User,
      },
    });

    expect(res.errors).toBeFalsy();

    const contentPreference = await con
      .getRepository(ContentPreferenceUser)
      .findOneBy({
        userId: '1-ublm',
        referenceId: '3-ublm',
      });

    expect(contentPreference).toBeNull();

    const notificationPreferences = await con
      .getRepository(NotificationPreferenceUser)
      .findBy({
        userId: '1-ublm',
        referenceUserId: '3-ublm',
      });

    expect(notificationPreferences).toHaveLength(0);
  });

  it('should remove notification preferences', async () => {
    loggedUser = '1-ublm';

    await con.getRepository(NotificationPreferenceUser).save([
      {
        userId: '1-ublm',
        referenceUserId: '2-ublm',
        referenceId: '2-ublm',
        status: NotificationPreferenceStatus.Subscribed,
        notificationType: NotificationType.UserPostAdded,
      },
    ]);

    const res = await client.query(MUTATION, {
      variables: {
        id: '2-ublm',
        entity: ContentPreferenceType.User,
      },
    });

    expect(res.errors).toBeFalsy();

    const contentPreference = await con
      .getRepository(ContentPreferenceUser)
      .findOneBy({
        userId: '1-ublm',
        referenceId: '2-ublm',
      });

    expect(contentPreference).toBeNull();

    const notificationPreferences = await con
      .getRepository(NotificationPreferenceUser)
      .findBy({
        userId: '1-ublm',
        referenceUserId: '2-ublm',
      });

    expect(notificationPreferences).toHaveLength(0);
  });

  describe('keyword', () => {
    beforeEach(async () => {
      await saveFixtures(con, Keyword, [
        { value: 'keyword-ublm1', occurrences: 300, status: 'allow' },
        { value: 'keyword-ublm2', occurrences: 200, status: 'allow' },
        { value: 'keyword-ublm3', occurrences: 100, status: 'allow' },
      ]);

      await saveFixtures(con, Feed, [{ id: '1-ublm', userId: '1-ublm' }]);

      await con.getRepository(ContentPreferenceKeyword).save([
        {
          userId: '1-ublm',
          referenceId: 'keyword-ublm1',
          feedId: '1-ublm',
          status: ContentPreferenceStatus.Blocked,
        },
        {
          userId: '2-ublm',
          referenceId: 'keyword-ublm2',
          feedId: '1-ublm',
          status: ContentPreferenceStatus.Blocked,
        },
      ]);

      await con.getRepository(FeedTag).save([
        {
          feedId: '1-ublm',
          tag: 'keyword-ublm1',
          blocked: true,
        },
        {
          feedId: '1-ublm',
          tag: 'keyword-ublm2',
          blocked: true,
        },
      ]);
    });

    it('should unblock', async () => {
      loggedUser = '1-ublm';

      const res = await client.query(MUTATION, {
        variables: {
          id: '2-ublm',
          entity: ContentPreferenceType.Keyword,
        },
      });

      expect(res.errors).toBeFalsy();

      const contentPreference = await con
        .getRepository(ContentPreferenceKeyword)
        .findOneBy({
          userId: '2-ublm',
          referenceId: 'keyword-ublm1',
        });

      expect(contentPreference).toBeNull();

      const feedSource = await con.getRepository(FeedTag).findOneBy({
        feedId: '2-fm',
        tag: 'keyword-ublm1',
      });
      expect(feedSource).toBeNull();
    });
  });

  describe('word', () => {
    beforeEach(async () => {
      await saveFixtures(con, Feed, [{ id: '1-ublm', userId: '1-ublm' }]);
      await con.getRepository(ContentPreferenceWord).save([
        {
          userId: '1-ublm',
          referenceId: 'word-ublm1',
          feedId: '1-ublm',
          status: ContentPreferenceStatus.Blocked,
        },
        {
          userId: '2-ublm',
          referenceId: 'word-ublm2',
          feedId: '1-ublm',
          status: ContentPreferenceStatus.Blocked,
        },
      ]);
    });

    it('should unblock', async () => {
      loggedUser = '1-ublm';

      const res = await client.query(MUTATION, {
        variables: {
          id: '2-ublm',
          entity: ContentPreferenceType.Word,
        },
      });

      expect(res.errors).toBeFalsy();

      const contentPreference = await con
        .getRepository(ContentPreferenceWord)
        .findOneBy({
          userId: '2-ublm',
          referenceId: 'word-ublm1',
        });

      expect(contentPreference).toBeNull();
    });
  });

  describe('source', () => {
    beforeEach(async () => {
      await saveFixtures(con, Source, [
        {
          id: 'a-ublm',
          name: 'A-ublm',
          image: 'http://image.com/a-ublm',
          handle: 'a-ublm',
          type: SourceType.Machine,
        },
      ]);

      await saveFixtures(con, Feed, [{ id: '1-ublm', userId: '1-ublm' }]);

      await con.getRepository(ContentPreferenceSource).save([
        {
          userId: '1-ublm',
          referenceId: 'a-ublm',
          feedId: '1-ublm',
          status: ContentPreferenceStatus.Blocked,
          sourceId: 'a-ublm',
        },
      ]);

      await con.getRepository(FeedSource).save([
        {
          feedId: '1-ublm',
          sourceId: 'a-ublm',
          blocked: true,
        },
      ]);
    });

    it('should unblock', async () => {
      loggedUser = '1-ublm';

      const res = await client.query(MUTATION, {
        variables: {
          id: 'a-ublm',
          entity: ContentPreferenceType.Source,
        },
      });

      expect(res.errors).toBeFalsy();

      const contentPreference = await con
        .getRepository(ContentPreferenceSource)
        .findOneBy({
          userId: '1-ublm',
          referenceId: 'a-ublm',
        });

      expect(contentPreference).toBeNull();

      const feedSource = await con.getRepository(FeedSource).findOneBy({
        feedId: '1-ublm',
        sourceId: 'a-ublm',
      });
      expect(feedSource).toBeNull();
    });
  });
});
