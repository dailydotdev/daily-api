import { User, Submission } from '../src/entity';
import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  testMutationErrorCode,
} from './helpers';
import { SubmissionFailErrorMessage } from '../src/errors';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import { badUsersFixture, usersFixture } from './fixture';

let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string = null;

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser),
  );
  client = state.client;
});

beforeEach(async () => {
  loggedUser = null;
  await saveFixtures(
    con,
    User,
    usersFixture.map((u) => ({ ...u, reputation: 250 })),
  );
  await saveFixtures(
    con,
    User,
    badUsersFixture.map((u) => ({ ...u, reputation: 250 })),
  );
});

afterAll(() => disposeGraphQLTesting(state));

describe('query submissionAvailability', () => {
  const QUERY = `
    query SubmissionAvailability {
      submissionAvailability {
        hasAccess
        limit
        todaySubmissionsCount
      }
    }
  `;

  it('should always return default values because of deprecation', async () => {
    loggedUser = '0';

    const res = await client.query(QUERY);

    expect(res.errors).toBeFalsy();
    expect(res.data.submissionAvailability.limit).toEqual(0);
    expect(res.data.submissionAvailability.hasAccess).toEqual(false);
    expect(res.data.submissionAvailability.todaySubmissionsCount).toEqual(0);
  });
});

describe('mutation submitArticle', () => {
  const MUTATION = `
    mutation SubmitArticle($url: String!) {
      submitArticle(url: $url) {
        result
        reason
        post {
          id
        }
        submission {
          id
          status
          userId
        }
      }
    }
  `;

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { url: 'http://abc.com' } },
      'UNAUTHENTICATED',
    ));

  it('should always return rejection because of deprecation', async () => {
    loggedUser = '1';
    const request = 'https://abc.com/article';
    const repo = con.getRepository(Submission);
    await repo.save(repo.create({ url: request, userId: loggedUser }));

    const res = await client.mutate(MUTATION, { variables: { url: request } });
    expect(res.errors).toBeFalsy();
    expect(res.data).toEqual({
      submitArticle: {
        result: 'rejected',
        reason: SubmissionFailErrorMessage.COMMUNITY_PICKS_DEPRECATED,
        post: null,
        submission: null,
      },
    });
  });
});
