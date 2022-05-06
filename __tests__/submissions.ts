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
    const submission = await con.getRepository(Submission).findOne(request);
    expect(submission.status).toEqual(SubmissionStatus.NotStarted);
  });
});
