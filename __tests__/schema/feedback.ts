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

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser, loggedRoles),
  );
  client = state.client;
});

beforeEach(async () => {
  loggedUser = null;
  loggedRoles = [];
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
  query FeedbackList($first: Int, $status: Int, $category: ProtoEnumValue) {
    feedbackList(first: $first, status: $status, category: $category) {
      edges {
        node {
          id
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

  it('should return filtered feedbackList for moderators', async () => {
    const matched = await con.getRepository(Feedback).save({
      userId: '1',
      category: UserFeedbackCategory.CONTENT_QUALITY,
      description: 'Matched feedback',
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
      status: FeedbackStatus.Completed,
      category: UserFeedbackCategory.CONTENT_QUALITY,
      user: {
        id: '1',
      },
      replies: [{ body: 'Resolved in production' }],
    });
  });
});
