import { Submission, SubmissionStatus } from '../src/entity/Submission';
import { User } from '../src/entity';
import { Connection, getConnection } from 'typeorm';
import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  testMutationErrorCode,
} from './helpers';
import { DEFAULT_SUBMISSION_LIMIT } from '../src/schema/submissions';
import { subDays } from 'date-fns';

let con: Connection;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string = null;

beforeAll(async () => {
  con = await getConnection();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser),
  );
  client = state.client;
});

beforeEach(async () => {
  loggedUser = null;
  await con
    .getRepository(User)
    .save({ id: '1', name: 'Lee', image: 'https://daily.dev/lee.jpg' });
});

afterAll(() => disposeGraphQLTesting(state));

describe('query submissionsAndLimit', () => {
  const QUERY = `
    query SubmissionsAndLimit {
      submissionsAndLimit {
        hasAccess
        limit
        todaySubmissionsCount
      }
    }
  `;

  it('should return default values if not logged in', async () => {
    const res = await client.query(QUERY);
    const limit = parseInt(
      process.env.SCOUT_SUBMISSION_LIMIT || DEFAULT_SUBMISSION_LIMIT,
    );
    expect(res.errors).toBeFalsy();
    expect(res.data.submissionsAndLimit.limit).toEqual(limit);
    expect(res.data.submissionsAndLimit.hasAccess).toEqual(false);
    expect(res.data.submissionsAndLimit.todaySubmissionsCount).toEqual(0);
  });

  it('should return submissions count today, limit, and if has access', async () => {
    loggedUser = '1';
    const repo = con.getRepository(Submission);
    await repo.save([
      { url: 'http://abc.com/1', userId: '1' },
      {
        url: 'http://abc.com/2',
        userId: '1',
        createdAt: subDays(new Date(), 1),
      },
    ]);
    const res = await client.query(QUERY);
    const limit = parseInt(
      process.env.SCOUT_SUBMISSION_LIMIT || DEFAULT_SUBMISSION_LIMIT,
    );
    expect(res.errors).toBeFalsy();
    expect(res.data.submissionsAndLimit.limit).toEqual(limit);
    expect(res.data.submissionsAndLimit.hasAccess).toEqual(true);
    expect(res.data.submissionsAndLimit.todaySubmissionsCount).toEqual(1);
  });
});

describe('mutation submitArticle', () => {
  const MUTATION = `
    mutation SubmitArticle($url: String!) {
      submitArticle(url: $url) {
        _
      }
    }
  `;

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { url: 'http://abc.com' } },
      'UNAUTHENTICATED',
    ));

  it('should invalidate if the url was requested already', async () => {
    loggedUser = '1';
    const request = 'https://abc.com/article';
    const repo = con.getRepository(Submission);
    await repo.save(repo.create({ url: request, userId: loggedUser }));
    testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { url: request } },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should not allow invalid urls', async () => {
    loggedUser = '1';
    const request = 'test/sample/url';
    testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { url: request } },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should create a submission entity if the url is valid', async () => {
    loggedUser = '1';
    const request = 'https://daily.dev/amazing/article';
    const res = await client.mutate(MUTATION, { variables: { url: request } });
    expect(res.errors).toBeFalsy();
    const submission = await con
      .getRepository(Submission)
      .findOne({ url: request });
    expect(submission.status).toEqual(SubmissionStatus.NotStarted);
  });
});
