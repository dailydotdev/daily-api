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
import { FreeformPost } from '../src/entity/posts/FreeformPost';
import { Feed, FeedOrigin } from '../src/entity/Feed';
import { AgentSource, SourceType, SourceUser } from '../src/entity/Source';
import { UserInterest, UserInterestStatus } from '../src/entity/UserInterest';
import {
  InterestFinding,
  InterestFindingStatus,
} from '../src/entity/InterestFinding';
import { InterestFeedback } from '../src/entity/InterestFeedback';
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
let isTeamMember = true;

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser, [], undefined, isTeamMember),
  );
  client = state.client;
});

beforeEach(async () => {
  loggedUser = null;
  isTeamMember = true;
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

  it('should reject a non-team-member', async () => {
    loggedUser = '1';
    isTeamMember = false;
    return testMutationErrorCode(
      client,
      { mutation: CREATE_INTEREST, variables: { query: 'cool zig projects' } },
      'FORBIDDEN',
    );
  });

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
      .getRepository(AgentSource)
      .findOneByOrFail({ id: interest.sourceId as string });
    expect(source.private).toBe(true);
    expect(source.type).toEqual(SourceType.Agent);

    const feed = await con
      .getRepository(Feed)
      .findOneByOrFail({ id: interest.feedId as string });
    expect(feed.userId).toEqual('1');
    expect(feed.flags.origin).toEqual(FeedOrigin.Agent);

    const runCall = (triggerTypedEvent as jest.Mock).mock.calls.find(
      (call) => call[1] === 'api.v1.interest-run-requested',
    );
    expect(runCall?.[2]).toEqual({ interestId });
  });

  it('should succeed when the user already has a user source', async () => {
    loggedUser = '1';
    await con.getRepository(SourceUser).save({
      id: 'su-1',
      name: 'user source',
      handle: 'su-1',
      private: true,
      userId: '1',
    });

    const res = await client.mutate(CREATE_INTEREST, {
      variables: { query: 'cool zig projects' },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.createInterest.id).toBeTruthy();
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
    testQueryErrorCode(client, { query: INTERESTS_QUERY }, 'UNAUTHENTICATED'));

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
    expect(
      res.data.interestFindings.map((f: { postId: string }) => f.postId),
    ).toEqual(['p2', 'p1']);
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

    const feedback = await con
      .getRepository(InterestFeedback)
      .findBy({ interestId: 'uir-1' });
    expect(feedback).toHaveLength(1);
    expect(feedback[0].text).toEqual('explore more');
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

const UPDATE_INTEREST = `
  mutation UpdateInterest($id: ID!, $data: UpdateInterestInput!) {
    updateInterest(id: $id, data: $data) {
      id
      status
      fomoThreshold
      sources
      outputModes
    }
  }
`;

const DELETE_INTEREST = `
  mutation DeleteInterest($id: ID!) {
    deleteInterest(id: $id) {
      _
    }
  }
`;

const INTEREST_POSTS = `
  query InterestPosts($id: ID!) {
    interestPosts(id: $id) {
      id
      title
    }
  }
`;

describe('mutation updateInterest', () => {
  beforeEach(async () => {
    await con.getRepository(UserInterest).save({
      id: 'uir-1',
      userId: '1',
      query: 'cool zig projects',
      status: UserInterestStatus.Active,
      fomoThreshold: 0.5,
      sources: { dailyDev: true, web: true, github: false },
      outputModes: {
        feed: true,
        post: true,
        digest: false,
        notification: true,
      },
    });
  });

  it('should update status, fomoThreshold and merge jsonb fields', async () => {
    loggedUser = '1';
    const res = await client.mutate(UPDATE_INTEREST, {
      variables: {
        id: 'uir-1',
        data: {
          status: UserInterestStatus.Paused,
          fomoThreshold: 0.8,
          outputModes: { notification: false },
        },
      },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.updateInterest).toMatchObject({
      status: UserInterestStatus.Paused,
      fomoThreshold: 0.8,
    });

    const interest = await con
      .getRepository(UserInterest)
      .findOneByOrFail({ id: 'uir-1' });
    expect(interest.outputModes).toMatchObject({
      feed: true,
      post: true,
      notification: false,
    });
  });

  it('should not update another user interest', async () => {
    loggedUser = '2';
    return testMutationErrorCode(
      client,
      {
        mutation: UPDATE_INTEREST,
        variables: { id: 'uir-1', data: { fomoThreshold: 0.1 } },
      },
      'NOT_FOUND',
    );
  });
});

describe('mutation deleteInterest', () => {
  beforeEach(async () => {
    await con.getRepository(UserInterest).save({
      id: 'uir-1',
      userId: '1',
      query: 'cool zig projects',
      status: UserInterestStatus.Active,
    });
    await con.getRepository(InterestFinding).save({
      id: 'if-1',
      interestId: 'uir-1',
      postId: 'p1',
      score: 0.5,
      status: InterestFindingStatus.Surfaced,
    });
  });

  it('should delete the interest and cascade its findings', async () => {
    loggedUser = '1';
    const res = await client.mutate(DELETE_INTEREST, {
      variables: { id: 'uir-1' },
    });
    expect(res.errors).toBeFalsy();

    const interest = await con
      .getRepository(UserInterest)
      .findOneBy({ id: 'uir-1' });
    expect(interest).toBeNull();
    const findings = await con
      .getRepository(InterestFinding)
      .findBy({ interestId: 'uir-1' });
    expect(findings).toHaveLength(0);
  });

  it('should reject an unknown interest', async () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      { mutation: DELETE_INTEREST, variables: { id: 'nope' } },
      'NOT_FOUND',
    );
  });
});

const POST_QUERY = `
  query Post($id: ID!) {
    post(id: $id) {
      id
    }
  }
`;

describe('agent source post access', () => {
  beforeEach(async () => {
    await con.getRepository(AgentSource).save({
      id: 'asrc-1',
      name: 'agent source',
      handle: 'agent-asrc-1',
      private: true,
    });
    await con.getRepository(UserInterest).save({
      id: 'uir-acc',
      userId: '1',
      query: 'cool zig projects',
      status: UserInterestStatus.Active,
      sourceId: 'asrc-1',
    });
    await saveFixtures(con, ArticlePost, [
      {
        id: 'apost-acc',
        shortId: 'apost-acc',
        title: 'Agent summary',
        url: 'http://agent.com/1',
        sourceId: 'asrc-1',
        private: true,
        visible: true,
      },
    ]);
  });

  it('lets the interest owner view an agent-source post', async () => {
    loggedUser = '1';
    const res = await client.query(POST_QUERY, {
      variables: { id: 'apost-acc' },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.post).toMatchObject({ id: 'apost-acc' });
  });

  it('denies a non-owner from viewing an agent-source post', async () => {
    loggedUser = '2';
    return testQueryErrorCode(
      client,
      { query: POST_QUERY, variables: { id: 'apost-acc' } },
      'FORBIDDEN',
    );
  });
});

describe('query interestPosts', () => {
  beforeEach(async () => {
    await con.getRepository(AgentSource).save({
      id: 'isrc-1',
      name: 'agent source',
      handle: 'agent-isrc-1',
      private: true,
    });
    await con.getRepository(UserInterest).save({
      id: 'uir-1',
      userId: '1',
      query: 'cool zig projects',
      status: UserInterestStatus.Active,
      sourceId: 'isrc-1',
    });
    await saveFixtures(con, FreeformPost, [
      {
        id: 'ipost-1',
        shortId: 'ipost-1',
        title: 'Interest summary',
        content: 'Interest summary content',
        sourceId: 'isrc-1',
        private: true,
        showOnFeed: false,
      },
    ]);
  });

  it('should return summary posts hosted in the interest source for the owner', async () => {
    loggedUser = '1';
    const res = await client.query(INTEREST_POSTS, {
      variables: { id: 'uir-1' },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.interestPosts).toHaveLength(1);
    expect(res.data.interestPosts[0]).toMatchObject({ id: 'ipost-1' });
  });

  it('should reject posts for a non-owner', async () => {
    loggedUser = '2';
    return testQueryErrorCode(
      client,
      { query: INTEREST_POSTS, variables: { id: 'uir-1' } },
      'NOT_FOUND',
    );
  });
});
