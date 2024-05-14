import {
  ArticlePost,
  Source,
  User,
  Submission,
  SubmissionStatus,
} from '../src/entity';
import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  testMutationErrorCode,
} from './helpers';
import { DEFAULT_SUBMISSION_LIMIT } from '../src/schema/submissions';
import { subDays } from 'date-fns';
import { sourcesFixture } from './fixture/source';
import { SubmissionFailErrorMessage } from '../src/errors';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';

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
  await con.getRepository(User).save({
    id: '1',
    name: 'Lee',
    image: 'https://daily.dev/lee.jpg',
    reputation: 250,
  });
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

  it('should return default values if not logged in', async () => {
    loggedUser = '0';

    const res = await client.query(QUERY);
    const limit = parseInt(
      process.env.SCOUT_SUBMISSION_LIMIT || DEFAULT_SUBMISSION_LIMIT,
    );
    expect(res.errors).toBeFalsy();
    expect(res.data.submissionAvailability.limit).toEqual(limit);
    expect(res.data.submissionAvailability.hasAccess).toEqual(false);
    expect(res.data.submissionAvailability.todaySubmissionsCount).toEqual(0);
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
    expect(res.data.submissionAvailability.limit).toEqual(limit);
    expect(res.data.submissionAvailability.hasAccess).toEqual(true);
    expect(res.data.submissionAvailability.todaySubmissionsCount).toEqual(1);
  });

  it('should return submissions count today, limit, and if has access in consideration of timezone', async () => {
    loggedUser = '1';
    await con.getRepository(User).save({
      id: '2',
      name: 'Hansel',
      image: 'https://daily.dev/hansel.jpg',
      reputation: 250,
    });
    await con.getRepository(User).save({
      id: '3',
      name: 'Solevilla',
      image: 'https://daily.dev/solevilla.jpg',
      reputation: 250,
    });
    await con
      .getRepository(User)
      .update({ id: '1' }, { timezone: 'Europe/Oslo' });
    const repo = con.getRepository(Submission);
    await repo.save([
      { url: 'http://abc.com/1', userId: '2' },
      { url: 'http://abc.com/2', userId: '3' },

      // 20:00 at UTC is 21:00 at Europe/Oslo (22:00 during summer)
      // So the submission should be counted as yesterday
      {
        url: 'http://abc.com/3',
        userId: '1',
        createdAt: subDays(new Date().setHours(20), 1),
      },

      // 23:00 at UTC is 01:00 at Europe/Oslo (02:00 during summer)
      // So the submission should be counted as the next day
      {
        url: 'http://abc.com/4',
        userId: '1',
        createdAt: subDays(new Date().setHours(23), 1),
      },
      {
        url: 'http://abc.com/5',
        userId: '1',
      },
    ]);
    const res = await client.query(QUERY);
    const limit = parseInt(
      process.env.SCOUT_SUBMISSION_LIMIT || DEFAULT_SUBMISSION_LIMIT,
    );
    expect(res.errors).toBeFalsy();
    expect(res.data.submissionAvailability.limit).toEqual(limit);
    expect(res.data.submissionAvailability.hasAccess).toEqual(true);
    expect(res.data.submissionAvailability.todaySubmissionsCount).toEqual(2);
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

  it('should invalidate if the url was requested already', async () => {
    loggedUser = '1';
    const request = 'https://abc.com/article';
    const repo = con.getRepository(Submission);
    await repo.save(repo.create({ url: request, userId: loggedUser }));

    const res = await client.mutate(MUTATION, { variables: { url: request } });
    expect(res.errors).toBeFalsy();
    expect(res.data).toEqual({
      submitArticle: {
        result: 'rejected',
        reason: SubmissionFailErrorMessage.EXISTS_STARTED,
        post: null,
        submission: null,
      },
    });
  });

  it('should invalidate if the user has reached limit', async () => {
    loggedUser = '1';
    const request = 'https://abc.com/article';
    const repo = con.getRepository(Submission);
    await repo.save(repo.create({ url: `${request}1`, userId: loggedUser }));
    await repo.save(repo.create({ url: `${request}2`, userId: loggedUser }));
    await repo.save(repo.create({ url: `${request}3`, userId: loggedUser }));

    const res = await client.mutate(MUTATION, { variables: { url: request } });
    expect(res.errors).toBeFalsy();
    expect(res.data).toEqual({
      submitArticle: {
        result: 'rejected',
        reason: SubmissionFailErrorMessage.LIMIT_REACHED,
        post: null,
        submission: null,
      },
    });
  });

  it('should invalidate if the user is ineligible for submission', async () => {
    loggedUser = '1';
    await con.getRepository(User).update({ id: '1' }, { reputation: 10 });
    const request = 'https://abc.com/article';
    const res = await client.mutate(MUTATION, { variables: { url: request } });
    expect(res.errors).toBeFalsy();
    expect(res.data).toEqual({
      submitArticle: {
        result: 'rejected',
        reason: SubmissionFailErrorMessage.ACCESS_DENIED,
        post: null,
        submission: null,
      },
    });
  });

  it('should reject if the post already exists', async () => {
    loggedUser = '1';
    const request = 'http://p1.com';
    await saveFixtures(con, Source, sourcesFixture);
    await saveFixtures(con, ArticlePost, [
      {
        id: 'p1',
        shortId: 'sp1',
        title: 'Post 1',
        url: request,
        canonicalUrl: request,
        score: 0,
        sourceId: 'a',
        createdAt: new Date('2021-09-22T07:15:51.247Z'),
        tagsStr: 'javascript,webdev',
      },
    ]);

    const res = await client.mutate(MUTATION, { variables: { url: request } });
    expect(res.errors).toBeFalsy();
    expect(res.data).toEqual({
      submitArticle: {
        result: 'exists',
        reason: null,
        post: {
          id: 'p1',
        },
        submission: null,
      },
    });
  });

  it('should reject if the post was deleted', async () => {
    loggedUser = '1';
    const request = 'http://p8.com';
    await saveFixtures(con, Source, sourcesFixture);
    await saveFixtures(con, ArticlePost, [
      {
        id: 'pdeleted',
        shortId: 'spdeleted',
        title: 'PDeleted',
        url: request,
        canonicalUrl: request,
        score: 0,
        sourceId: 'a',
        createdAt: new Date('2021-09-22T07:15:51.247Z'),
        tagsStr: 'javascript,webdev',
        deleted: true,
      },
    ]);

    const res = await client.mutate(MUTATION, { variables: { url: request } });
    expect(res.errors).toBeFalsy();
    expect(res.data).toEqual({
      submitArticle: {
        result: 'rejected',
        reason: SubmissionFailErrorMessage.POST_DELETED,
        post: null,
        submission: null,
      },
    });
  });

  it('should not allow invalid urls', async () => {
    loggedUser = '1';
    const request = 'test/sample/url';
    const res = await client.mutate(MUTATION, { variables: { url: request } });
    expect(res.errors).toBeFalsy();
    expect(res.data).toEqual({
      submitArticle: {
        result: 'rejected',
        reason: SubmissionFailErrorMessage.INVALID_URL,
        post: null,
        submission: null,
      },
    });
  });

  it('should create a submission entity if the url is valid', async () => {
    loggedUser = '1';
    const request = 'https://daily.dev/amazing/article';
    const res = await client.mutate(MUTATION, { variables: { url: request } });
    expect(res.errors).toBeFalsy();
    const submission = await con
      .getRepository(Submission)
      .findOneBy({ url: request });
    expect(submission.status).toEqual(SubmissionStatus.Started);
    expect(res.data).toMatchSnapshot({
      submitArticle: {
        submission: {
          id: expect.any(String),
        },
      },
    });
  });
});
