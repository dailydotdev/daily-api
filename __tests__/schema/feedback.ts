import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  testQueryErrorCode,
} from '../helpers';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { Feedback, FeedbackStatus } from '../../src/entity/Feedback';
import { FeedbackReply } from '../../src/entity/FeedbackReply';
import { User } from '../../src/entity/user/User';
import { usersFixture } from '../fixture/user';
import { Roles } from '../../src/roles';
import { UserFeedbackCategory } from '@dailydotdev/schema';

let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string | null = null;
let loggedRoles: Roles[] = [];
let loggedIsTeamMember = false;

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    () =>
      new MockContext(
        con,
        loggedUser,
        loggedRoles,
        undefined,
        loggedIsTeamMember,
      ),
  );
  client = state.client;
});

beforeEach(async () => {
  loggedUser = null;
  loggedRoles = [];
  loggedIsTeamMember = false;
  await saveFixtures(con, User, usersFixture);
});

afterAll(async () => {
  await disposeGraphQLTesting(state);
});

const USER_FEEDBACK_QUERY = `
  query UserFeedback($after: String, $first: Int) {
    userFeedback(after: $after, first: $first) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          category
          description
          status
          createdAt
          replies {
            id
            body
            authorName
          }
        }
      }
    }
  }
`;

const FEEDBACK_LIST_QUERY = `
  query FeedbackList(
    $first: Int
    $status: Int
    $statuses: [Int!]
    $category: ProtoEnumValue
  ) {
    feedbackList(
      first: $first
      status: $status
      statuses: $statuses
      category: $category
    ) {
      edges {
        node {
          id
          linearIssueUrl
          status
          category
          user {
            id
            username
          }
          replies {
            id
            body
          }
        }
      }
    }
  }
`;

const USER_FEEDBACK_BY_USER_ID_QUERY = `
  query UserFeedbackByUserId($userId: ID!, $after: String, $first: Int) {
    userFeedbackByUserId(userId: $userId, after: $after, first: $first) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          category
          description
          linearIssueUrl
          status
          user {
            id
            username
          }
          replies {
            id
            body
            authorName
          }
        }
      }
    }
  }
`;

describe('feedback schema', () => {
  it('should require authentication for userFeedback', async () => {
    await testQueryErrorCode(
      client,
      { query: USER_FEEDBACK_QUERY },
      'UNAUTHENTICATED',
    );
  });

  it('should return only authenticated user feedback with replies', async () => {
    const ownFeedback = await con.getRepository(Feedback).save({
      userId: '1',
      category: UserFeedbackCategory.BUG,
      description: 'Own feedback',
      status: FeedbackStatus.Pending,
      flags: {},
    });

    await con.getRepository(Feedback).save({
      userId: '2',
      category: UserFeedbackCategory.FEATURE_REQUEST,
      description: 'Other user feedback',
      status: FeedbackStatus.Completed,
      flags: {},
    });

    await con.getRepository(FeedbackReply).save({
      feedbackId: ownFeedback.id,
      body: 'Thanks for sharing',
      authorName: 'Chris',
      authorEmail: 'chris@daily.dev',
    });

    loggedUser = '1';

    const res = await client.query(USER_FEEDBACK_QUERY, {
      variables: { first: 10 },
    });

    expect(res.errors).toBeUndefined();
    expect(res.data.userFeedback.edges).toHaveLength(1);
    expect(res.data.userFeedback.edges[0].node).toMatchObject({
      id: ownFeedback.id,
      description: 'Own feedback',
      replies: [{ body: 'Thanks for sharing', authorName: 'Chris' }],
    });
  });

  it('should block feedbackList for non-moderators', async () => {
    loggedUser = '1';

    await testQueryErrorCode(
      client,
      { query: FEEDBACK_LIST_QUERY, variables: { first: 10 } },
      'FORBIDDEN',
    );
  });

  it('should return filtered feedbackList for team members', async () => {
    const pendingFeedback = await con.getRepository(Feedback).save({
      userId: '1',
      category: UserFeedbackCategory.BUG,
      description: 'Pending feedback',
      linearIssueUrl: 'https://linear.app/dailydev/issue/ENG-1159',
      status: FeedbackStatus.Pending,
      flags: {},
    });

    await con.getRepository(Feedback).save({
      userId: '2',
      category: UserFeedbackCategory.BUG,
      description: 'Completed feedback',
      status: FeedbackStatus.Completed,
      flags: {},
    });

    loggedUser = '3';
    loggedIsTeamMember = true;

    const res = await client.query(FEEDBACK_LIST_QUERY, {
      variables: {
        first: 10,
        statuses: [
          FeedbackStatus.Pending,
          FeedbackStatus.Processing,
          FeedbackStatus.Accepted,
        ],
      },
    });

    expect(res.errors).toBeUndefined();
    expect(res.data.feedbackList.edges).toHaveLength(1);
    expect(res.data.feedbackList.edges[0].node).toMatchObject({
      id: pendingFeedback.id,
      linearIssueUrl: 'https://linear.app/dailydev/issue/ENG-1159',
      user: {
        id: '1',
      },
    });
  });

  it('should return filtered feedbackList for moderators', async () => {
    const matched = await con.getRepository(Feedback).save({
      userId: '1',
      category: UserFeedbackCategory.CONTENT_QUALITY,
      description: 'Matched feedback',
      linearIssueUrl: 'https://linear.app/dailydev/issue/ENG-1159',
      status: FeedbackStatus.Completed,
      flags: {},
    });

    await con.getRepository(Feedback).save({
      userId: '2',
      category: UserFeedbackCategory.BUG,
      description: 'Filtered out feedback',
      status: FeedbackStatus.Pending,
      flags: {},
    });

    await con.getRepository(FeedbackReply).save({
      feedbackId: matched.id,
      body: 'Resolved in production',
      authorName: 'Moderator',
    });

    loggedUser = '3';
    loggedRoles = [Roles.Moderator];

    const res = await client.query(FEEDBACK_LIST_QUERY, {
      variables: {
        first: 10,
        status: FeedbackStatus.Completed,
        category: UserFeedbackCategory.CONTENT_QUALITY,
      },
    });

    expect(res.errors).toBeUndefined();
    expect(res.data.feedbackList.edges).toHaveLength(1);
    expect(res.data.feedbackList.edges[0].node).toMatchObject({
      id: matched.id,
      linearIssueUrl: 'https://linear.app/dailydev/issue/ENG-1159',
      status: FeedbackStatus.Completed,
      category: UserFeedbackCategory.CONTENT_QUALITY,
      user: {
        id: '1',
      },
      replies: [{ body: 'Resolved in production' }],
    });
  });

  it('should require authentication for userFeedbackByUserId', async () => {
    await testQueryErrorCode(
      client,
      {
        query: USER_FEEDBACK_BY_USER_ID_QUERY,
        variables: { userId: '1', first: 10 },
      },
      'UNAUTHENTICATED',
    );
  });

  it('should block userFeedbackByUserId for non-team members', async () => {
    loggedUser = '1';

    await testQueryErrorCode(
      client,
      {
        query: USER_FEEDBACK_BY_USER_ID_QUERY,
        variables: { userId: '2', first: 10 },
      },
      'FORBIDDEN',
    );
  });

  it('should return requested user feedback with replies for team members', async () => {
    const firstFeedback = await con.getRepository(Feedback).save({
      userId: '2',
      category: UserFeedbackCategory.BUG,
      description: 'User 2 feedback 1',
      linearIssueUrl: 'https://linear.app/dailydev/issue/ENG-1158',
      status: FeedbackStatus.Pending,
      flags: {},
    });

    const secondFeedback = await con.getRepository(Feedback).save({
      userId: '2',
      category: UserFeedbackCategory.FEATURE_REQUEST,
      description: 'User 2 feedback 2',
      linearIssueUrl: 'https://linear.app/dailydev/issue/ENG-1159',
      status: FeedbackStatus.Processing,
      flags: {},
    });

    await con.getRepository(Feedback).save({
      userId: '1',
      category: UserFeedbackCategory.CONTENT_QUALITY,
      description: 'Different user feedback',
      status: FeedbackStatus.Completed,
      flags: {},
    });

    await con.getRepository(FeedbackReply).save({
      feedbackId: secondFeedback.id,
      body: 'Thanks, we are investigating',
      authorName: 'Support',
    });

    loggedUser = '3';
    loggedIsTeamMember = true;

    const res = await client.query(USER_FEEDBACK_BY_USER_ID_QUERY, {
      variables: { userId: '2', first: 10 },
    });

    expect(res.errors).toBeUndefined();
    expect(res.data.userFeedbackByUserId.edges).toHaveLength(2);
    expect(
      res.data.userFeedbackByUserId.edges.map((edge) => edge.node.id),
    ).toEqual([secondFeedback.id, firstFeedback.id]);
    expect(res.data.userFeedbackByUserId.edges[0].node).toMatchObject({
      linearIssueUrl: 'https://linear.app/dailydev/issue/ENG-1159',
      user: {
        id: '2',
      },
      replies: [
        { body: 'Thanks, we are investigating', authorName: 'Support' },
      ],
    });
    expect(res.data.userFeedbackByUserId.edges[1].node).toMatchObject({
      linearIssueUrl: 'https://linear.app/dailydev/issue/ENG-1158',
    });
  });

  it('should paginate userFeedbackByUserId results for team members', async () => {
    const firstFeedback = await con.getRepository(Feedback).save({
      userId: '2',
      category: UserFeedbackCategory.BUG,
      description: 'Older feedback',
      status: FeedbackStatus.Pending,
      flags: {},
    });

    const secondFeedback = await con.getRepository(Feedback).save({
      userId: '2',
      category: UserFeedbackCategory.OTHER,
      description: 'Newer feedback',
      status: FeedbackStatus.Pending,
      flags: {},
    });

    loggedUser = '3';
    loggedIsTeamMember = true;

    const firstPage = await client.query(USER_FEEDBACK_BY_USER_ID_QUERY, {
      variables: { userId: '2', first: 1 },
    });

    expect(firstPage.errors).toBeUndefined();
    expect(firstPage.data.userFeedbackByUserId.edges).toHaveLength(1);
    expect(firstPage.data.userFeedbackByUserId.edges[0].node.id).toEqual(
      secondFeedback.id,
    );
    expect(firstPage.data.userFeedbackByUserId.pageInfo.hasNextPage).toEqual(
      true,
    );

    const secondPage = await client.query(USER_FEEDBACK_BY_USER_ID_QUERY, {
      variables: {
        userId: '2',
        first: 1,
        after: firstPage.data.userFeedbackByUserId.pageInfo.endCursor,
      },
    });

    expect(secondPage.errors).toBeUndefined();
    expect(secondPage.data.userFeedbackByUserId.edges).toHaveLength(1);
    expect(secondPage.data.userFeedbackByUserId.edges[0].node.id).toEqual(
      firstFeedback.id,
    );
    expect(secondPage.data.userFeedbackByUserId.pageInfo.hasNextPage).toEqual(
      false,
    );
  });
});
