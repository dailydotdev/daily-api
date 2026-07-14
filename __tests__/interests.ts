import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import {
  GraphQLTestClient,
  GraphQLTestingState,
  MockContext,
  disposeGraphQLTesting,
  initializeGraphQLTesting,
  saveFixtures,
  testMutationErrorCode,
  testQueryErrorCode,
} from './helpers';
import { ArticlePost, Source, User } from '../src/entity';
import { Feed } from '../src/entity/Feed';
import { InterestSource, SourceType } from '../src/entity/Source';
import {
  UserInterest,
  UserInterestStatus,
} from '../src/entity/UserInterest';
import {
  InterestFinding,
  InterestFindingStatus,
} from '../src/entity/InterestFinding';
import { usersFixture } from './fixture/user';
import { postsFixture } from './fixture/post';
import { sourcesFixture } from './fixture';
import { triggerTypedEvent } from '../src/common/typedPubsub';

jest.mock('../src/common/typedPubsub', () => ({
  ...(jest.requireActual('../src/common/typedPubsub') as Record<
    string,
    unknown
  >),
  triggerTypedEvent: jest.fn(),
}));

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

beforeEach(async () => {
  loggedUser = null;
  jest.resetAllMocks();
  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, ArticlePost, postsFixture);
});

afterAll(() => disposeGraphQLTesting(state));

const CREATE_INTEREST = `
  mutation CreateInterest($query: String!) {
    createInterest(query: $query) {
      id
      query
      status
      feedId
      sourceId
    }
  }
`;

const SEND_COMMAND = `
  mutation SendInterestCommand($id: ID!, $text: String!) {
    sendInterestCommand(id: $id, text: $text) {
      id
    }
  }
`;

const INTEREST_QUERY = `
  query Interest($id: ID!) {
    interest(id: $id) {
      id
      query
      status
    }
  }
`;

const INTEREST_FINDINGS = `
  query InterestFindings($id: ID!) {
    interestFindings(id: $id) {
      id
      postId
      score
      rationale
      status
    }
  }
`;

describe('mutation createInterest', () => {
  it('should not allow unauthenticated user', () =>
    testMutationErrorCode(
      client,
      { mutation: CREATE_INTEREST, variables: { query: 'cool zig projects' } },
      'UNAUTHENTICATED',
    ));

  it('should reject an empty query', async () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      { mutation: CREATE_INTEREST, variables: { query: '' } },
      'ZOD_VALIDATION_ERROR',
    );
  });

  it('should provision a private source, a feed, and the interest, then trigger a run', async () => {
    loggedUser = '1';
    const res = await client.mutate(CREATE_INTEREST, {
      variables: { query: 'cool zig projects' },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.createInterest).toMatchObject({
      query: 'cool zig projects',
      status: UserInterestStatus.Active,
    });

    const interestId = res.data.createInterest.id;
    const interest = await con
      .getRepository(UserInterest)
      .findOneByOrFail({ id: interestId });
    expect(interest.userId).toEqual('1');

    const source = await con
      .getRepository(InterestSource)
      .findOneByOrFail({ id: interest.sourceId as string });
    expect(source.private).toBe(true);
    expect(source.type).toEqual(SourceType.Interest);

    const feed = await con
      .getRepository(Feed)
      .findOneByOrFail({ id: interest.feedId as string });
    expect(feed.userId).toEqual('1');

    const runCall = (triggerTypedEvent as jest.Mock).mock.calls.find(
      (call) => call[1] === 'api.v1.interest-run-requested',
    );
    expect(runCall?.[2]).toEqual({ interestId });
  });
});

const INTERESTS_QUERY = `
  query Interests {
    interests {
      id
      query
      status
    }
  }
`;

describe('query interests', () => {
  beforeEach(async () => {
    await con.getRepository(UserInterest).save([
      {
        id: 'uir-1',
        userId: '1',
        query: 'cool zig projects',
        status: UserInterestStatus.Active,
      },
      {
        id: 'uir-2',
        userId: '2',
        query: 'rust gamedev',
        status: UserInterestStatus.Active,
      },
    ]);
  });

  it('should not allow unauthenticated user', () =>
    testQueryErrorCode(
      client,
      { query: INTERESTS_QUERY },
      'UNAUTHENTICATED',
    ));

  it('should return only the current user interests', async () => {
    loggedUser = '1';
    const res = await client.query(INTERESTS_QUERY);
    expect(res.errors).toBeFalsy();
    expect(res.data.interests).toHaveLength(1);
    expect(res.data.interests[0]).toMatchObject({ id: 'uir-1' });
  });
});

describe('query interest', () => {
  beforeEach(async () => {
    await con.getRepository(UserInterest).save({
      id: 'uir-1',
      userId: '1',
      query: 'cool zig projects',
      status: UserInterestStatus.Active,
    });
  });

  it('should return the interest for its owner', async () => {
    loggedUser = '1';
    const res = await client.query(INTEREST_QUERY, {
      variables: { id: 'uir-1' },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.interest).toMatchObject({
      id: 'uir-1',
      query: 'cool zig projects',
    });
  });

  it('should not return another user interest', async () => {
    loggedUser = '2';
    const res = await client.query(INTEREST_QUERY, {
      variables: { id: 'uir-1' },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.interest).toBeNull();
  });
});

describe('query interestFindings', () => {
  beforeEach(async () => {
    await con.getRepository(UserInterest).save({
      id: 'uir-1',
      userId: '1',
      query: 'cool zig projects',
      status: UserInterestStatus.Active,
    });
    await con.getRepository(InterestFinding).save([
      {
        id: 'if-1',
        interestId: 'uir-1',
        postId: 'p1',
        score: 0.4,
        rationale: 'ok',
        status: InterestFindingStatus.Surfaced,
      },
      {
        id: 'if-2',
        interestId: 'uir-1',
        postId: 'p2',
        score: 0.9,
        rationale: 'great',
        status: InterestFindingStatus.Surfaced,
      },
    ]);
  });

  it('should return findings ordered by score desc for the owner', async () => {
    loggedUser = '1';
    const res = await client.query(INTEREST_FINDINGS, {
      variables: { id: 'uir-1' },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.interestFindings.map((f: { postId: string }) => f.postId)).toEqual([
      'p2',
      'p1',
    ]);
  });

  it('should reject findings for a non-owner', async () => {
    loggedUser = '2';
    return testQueryErrorCode(
      client,
      { query: INTEREST_FINDINGS, variables: { id: 'uir-1' } },
      'NOT_FOUND',
    );
  });
});

describe('mutation sendInterestCommand', () => {
  beforeEach(async () => {
    await con.getRepository(UserInterest).save({
      id: 'uir-1',
      userId: '1',
      query: 'cool zig projects',
      status: UserInterestStatus.Active,
    });
  });

  it('should re-trigger a run for the owner', async () => {
    loggedUser = '1';
    const res = await client.mutate(SEND_COMMAND, {
      variables: { id: 'uir-1', text: 'explore more' },
    });
    expect(res.errors).toBeFalsy();
    const runCall = (triggerTypedEvent as jest.Mock).mock.calls.find(
      (call) => call[1] === 'api.v1.interest-run-requested',
    );
    expect(runCall?.[2]).toEqual({ interestId: 'uir-1' });
  });

  it('should reject an unknown interest', async () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      { mutation: SEND_COMMAND, variables: { id: 'nope', text: 'hi' } },
      'NOT_FOUND',
    );
  });
});
