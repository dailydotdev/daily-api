import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  Mutation,
  saveFixtures,
  testMutationErrorCode,
  testQueryErrorCode,
} from './helpers';
import { Roles, SourceMemberRoles } from '../src/roles';
import {
  Source,
  SourceMember,
  SquadPublicRequest,
  SquadPublicRequestStatus,
  User,
} from '../src/entity';
import { sourcesFixture } from './fixture/source';
import { usersFixture } from './fixture/user';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';

let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string | null = null;
let roles: Roles[] = [];
const squadId = 'squad';

jest.mock('../src/common', () => ({
  ...(jest.requireActual('../src/common') as Record<string, unknown>),
  uploadLogo: jest.fn(),
}));

const testModeratorAuthorization = (mutation: Mutation): Promise<void> => {
  roles = [];
  return testMutationErrorCode(client, mutation, 'FORBIDDEN');
};

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser, false, roles),
  );
  client = state.client;
});

beforeEach(async () => {
  loggedUser = null;
  roles = [];
  await saveFixtures(con, Source, [sourcesFixture[5]]);
  await saveFixtures(con, User, usersFixture);
  await con.getRepository(SourceMember).save([
    {
      userId: '1',
      sourceId: squadId,
      role: SourceMemberRoles.Admin,
      referralToken: 'rt1',
      createdAt: new Date(2022, 11, 19),
    },
    {
      userId: '2',
      sourceId: squadId,
      role: SourceMemberRoles.Moderator,
      referralToken: 'rt2',
      createdAt: new Date(2022, 11, 20),
    },
    {
      userId: '3',
      sourceId: squadId,
      role: SourceMemberRoles.Member,
      referralToken: 'rt3',
      createdAt: new Date(2022, 11, 19),
    },
  ]);

  con.getRepository(SquadPublicRequest).clear();
});

afterAll(() => disposeGraphQLTesting(state));

describe('mutation submitSquadForReview', () => {
  const MUTATION = `
  mutation SubmitSquadForReview($squadId: ID!) {
    submitSquadForReview(squadId: $squadId) {
      sourceId
      requestorId
      status
    }
  }`;

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { squadId },
      },
      'UNAUTHENTICATED',
    ));

  it('should not authorize when user is not MODERATOR of the squad', () => {
    loggedUser = '3';
    roles = [];
    return testModeratorAuthorization({
      mutation: MUTATION,
      variables: { squadId },
    });
  });

  it('should not authorize when user is not ADMIN of the squad', () => {
    loggedUser = '2';
    roles = [Roles.Moderator];
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { squadId },
      },
      'FORBIDDEN',
    );
  });

  it('should return bad request when squadID is not valid', async () => {
    loggedUser = '1';
    roles = [Roles.Moderator];
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { squadId: null },
      },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should fail if squadID does not match a squad', async () => {
    loggedUser = '1';
    roles = [Roles.Moderator];
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { squadId: 'invalid' },
      },
      'NOT_FOUND',
    );
  });

  it('should add new source request', async () => {
    loggedUser = '1';
    roles = [Roles.Moderator];
    const res = await client.mutate(MUTATION, {
      variables: { squadId },
    });
    expect(res.data.submitSquadForReview).toMatchObject({
      sourceId: squadId,
      requestorId: loggedUser,
      status: SquadPublicRequestStatus.Pending,
    });
  });

  it('should fail if there already is a pending request', async () => {
    const repo = con.getRepository(SquadPublicRequest);
    await repo.save({
      sourceId: squadId,
      requestorId: '1',
      status: SquadPublicRequestStatus.Pending,
    });

    loggedUser = '1';
    roles = [Roles.Moderator];
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { squadId },
      },
      'CONFLICT',
    );
  });

  it('should fail if there already is a rejected request within last 14 days', async () => {
    const repo = con.getRepository(SquadPublicRequest);
    await repo.save({
      sourceId: squadId,
      requestorId: '1',
      status: SquadPublicRequestStatus.Rejected,
    });

    loggedUser = '1';
    roles = [Roles.Moderator];
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { squadId },
      },
      'CONFLICT',
    );
  });

  it('should succeed if the rejected request is older than 14 days', async () => {
    const olderDate = new Date();
    olderDate.setDate(olderDate.getDate() - 15);

    const repo = con.getRepository(SquadPublicRequest);
    await repo.save({
      sourceId: squadId,
      requestorId: '1',
      status: SquadPublicRequestStatus.Rejected,
      updatedAt: olderDate,
      createdAt: olderDate,
    });

    loggedUser = '1';
    roles = [Roles.Moderator];
    const res = await client.mutate(MUTATION, {
      variables: { squadId },
    });
    expect(res.data.submitSquadForReview).toMatchObject({
      sourceId: squadId,
      requestorId: loggedUser,
      status: SquadPublicRequestStatus.Pending,
    });
  });
});

describe('query pendingSourceRequests', () => {
  const query = `query PublicSquadRequests($squadId: String!, $first: Int) {
    publicSquadRequests(squadId: $squadId, first: $first) {
      pageInfo {
        endCursor
        hasNextPage
      }
      edges {
        node {
          requestorId
          status
        }
      }
    }
  }`;

  it('should not authorize when not moderator', async () => {
    roles = [];
    loggedUser = '1';
    return testQueryErrorCode(
      client,
      { query, variables: { first: 10, squadId } },
      'FORBIDDEN',
    );
  });

  it('should not authorize when not admin', async () => {
    roles = [Roles.Moderator];
    loggedUser = '2';
    return testQueryErrorCode(
      client,
      { query, variables: { first: 10, squadId } },
      'FORBIDDEN',
    );
  });

  it('should not return anything for non-matching squadId', async () => {
    roles = [Roles.Moderator];
    loggedUser = '2';
    return testQueryErrorCode(
      client,
      { query, variables: { first: 10, squadId: 'invalid' } },
      'NOT_FOUND',
    );
  });

  it('should return pending source requests', async () => {
    roles = [Roles.Moderator];
    loggedUser = '1';

    await con.getRepository(SquadPublicRequest).save({
      sourceId: squadId,
      requestorId: '2',
      status: SquadPublicRequestStatus.Rejected,
    });
    await con.getRepository(SquadPublicRequest).save({
      sourceId: squadId,
      requestorId: '1',
      status: SquadPublicRequestStatus.Pending,
    });

    const res = await client.query(query, {
      variables: { first: 10, squadId },
    });
    expect(res.data).toMatchObject({
      publicSquadRequests: {
        pageInfo: {
          hasNextPage: false,
        },
        edges: [
          {
            node: {
              requestorId: '1',
              status: SquadPublicRequestStatus.Pending,
            },
          },
          {
            node: {
              requestorId: '2',
              status: SquadPublicRequestStatus.Rejected,
            },
          },
        ],
      },
    });
  });
});
