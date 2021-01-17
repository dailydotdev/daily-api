import { FastifyInstance } from 'fastify';
import { Connection, getConnection } from 'typeorm';
import { ApolloServer } from 'apollo-server-fastify';
import {
  ApolloServerTestClient,
  createTestClient,
} from 'apollo-server-testing';

import createApolloServer from '../src/apollo';
import { Context } from '../src/Context';
import {
  MockContext,
  Mutation,
  Query,
  saveFixtures,
  testMutationErrorCode,
  testQueryErrorCode,
} from './helpers';
import appFunc from '../src';
import { Roles } from '../src/roles';
import {
  Keyword,
  Post,
  PostKeyword,
  Source,
  SourceDisplay,
} from '../src/entity';
import { mocked } from 'ts-jest/utils';
import { notifyKeywordUpdated } from '../src/common';
import { sourceDisplaysFixture } from './fixture/sourceDisplay';
import { sourcesFixture } from './fixture/source';
import { postsFixture } from './fixture/post';

jest.mock('../src/common/pubsub', () => ({
  ...jest.requireActual('../src/common/pubsub'),
  notifyKeywordUpdated: jest.fn(),
}));

let app: FastifyInstance;
let con: Connection;
let server: ApolloServer;
let client: ApolloServerTestClient;
let loggedUser: string = null;
let roles: Roles[] = [];

beforeAll(async () => {
  con = await getConnection();
  server = await createApolloServer({
    context: (): Context => new MockContext(con, loggedUser, false, roles),
    playground: false,
  });
  client = createTestClient(server);
  app = await appFunc();
  return app.ready();
});

beforeEach(async () => {
  jest.resetAllMocks();
  loggedUser = null;
  roles = [];

  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, SourceDisplay, sourceDisplaysFixture);
  await saveFixtures(con, Post, postsFixture);
});

afterAll(() => app.close());

const testModeratorQueryAuthorization = (query: Query): Promise<void> => {
  roles = [];
  loggedUser = '1';
  return testQueryErrorCode(client, query, 'FORBIDDEN');
};

const testModeratorMutationAuthorization = (
  mutation: Mutation,
): Promise<void> => {
  roles = [];
  loggedUser = '1';
  return testMutationErrorCode(client, mutation, 'FORBIDDEN');
};

describe('query randomPendingKeyword', () => {
  const QUERY = `{
    randomPendingKeyword {
      value, status, occurrences
    }
  }`;

  it('should not authorize when not moderator', () =>
    testModeratorQueryAuthorization({
      query: QUERY,
    }));

  it('should return an eligible pending keyword', async () => {
    roles = [Roles.Moderator];
    loggedUser = '1';
    await con
      .getRepository(Keyword)
      .save([
        { value: 'nodejs', status: 'allow', occurrences: 200 },
        { value: 'react' },
        { value: 'go', occurrences: 100 },
      ]);
    const res = await client.query({ query: QUERY });
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
  });
});

describe('query countPendingKeywords', () => {
  const QUERY = `{ countPendingKeywords }`;

  it('should not authorize when not moderator', () =>
    testModeratorQueryAuthorization({
      query: QUERY,
    }));

  it('should return the number of pending keywords', async () => {
    roles = [Roles.Moderator];
    loggedUser = '1';
    await con
      .getRepository(Keyword)
      .save([
        { value: 'nodejs', status: 'allow', occurrences: 200 },
        { value: 'react', occurrences: 300 },
        { value: 'go', occurrences: 100 },
        { value: 'vuejs' },
      ]);
    const res = await client.query({ query: QUERY });
    expect(res.errors).toBeFalsy();
    expect(res.data.countPendingKeywords).toEqual(2);
  });
});

describe('query searchKeywords', () => {
  const QUERY = `
  query SearchKeywords($query: String!) {
    searchKeywords(query: $query) {
      query, hits { value, status, occurrences }
    }
  }`;

  it('should not authorize when not moderator', () =>
    testModeratorQueryAuthorization({
      query: QUERY,
      variables: { query: 'script' },
    }));

  it('should return search results', async () => {
    roles = [Roles.Moderator];
    loggedUser = '1';
    await con.getRepository(Keyword).save([
      { value: 'javascript', status: 'allow', occurrences: 20 },
      { value: 'java', status: 'allow' },
      { value: 'typescript', occurrences: 50 },
      { value: 'nativescript', status: 'allow', occurrences: 80 },
    ]);
    const res = await client.query({
      query: QUERY,
      variables: { query: 'script' },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
  });
});

describe('query keyword', () => {
  const QUERY = `
  query Keyword($value: String!) {
    keyword(value: $value) {
      value, status, occurrences
    }
  }`;

  it('should not authorize when not moderator', () =>
    testModeratorQueryAuthorization({
      query: QUERY,
      variables: { value: 'nodejs' },
    }));

  it('should return keyword', async () => {
    roles = [Roles.Moderator];
    loggedUser = '1';
    await con.getRepository(Keyword).save([
      { value: 'nodejs', status: 'allow', occurrences: 200 },
      { value: 'react', occurrences: 300 },
    ]);
    const res = await client.query({
      query: QUERY,
      variables: { value: 'nodejs' },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
  });

  it('should return null when keyword does not exist', async () => {
    roles = [Roles.Moderator];
    loggedUser = '1';
    await con.getRepository(Keyword).save([
      { value: 'nodejs', status: 'allow', occurrences: 200 },
      { value: 'react', occurrences: 300 },
    ]);
    const res = await client.query({
      query: QUERY,
      variables: { value: 'go' },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
  });
});

describe('mutation allowKeyword', () => {
  const MUTATION = `
  mutation AllowKeyword($keyword: String!) {
    allowKeyword(keyword: $keyword) {
      _
    }
  }`;

  it('should not authorize when not moderator', () =>
    testModeratorMutationAuthorization({
      mutation: MUTATION,
      variables: { keyword: 'java' },
    }));

  it('should allow existing keyword', async () => {
    roles = [Roles.Moderator];
    loggedUser = '1';
    await con.getRepository(Keyword).save([{ value: 'java', occurrences: 20 }]);
    const res = await client.mutate({
      mutation: MUTATION,
      variables: { keyword: 'java' },
    });
    expect(res.errors).toBeFalsy();
    const keywords = await con.getRepository(Keyword).find({
      select: ['value', 'status', 'occurrences'],
      order: { value: 'ASC' },
    });
    expect(keywords).toMatchSnapshot();
    expect(mocked(notifyKeywordUpdated).mock.calls[0].slice(1)).toEqual([
      'java',
    ]);
  });

  it('should create a new keyword and allow it', async () => {
    roles = [Roles.Moderator];
    loggedUser = '1';
    const res = await client.mutate({
      mutation: MUTATION,
      variables: { keyword: 'java' },
    });
    expect(res.errors).toBeFalsy();
    const keywords = await con.getRepository(Keyword).find({
      select: ['value', 'status', 'occurrences'],
      order: { value: 'ASC' },
    });
    expect(keywords).toMatchSnapshot();
    expect(mocked(notifyKeywordUpdated).mock.calls[0].slice(1)).toEqual([
      'java',
    ]);
  });
});

describe('mutation denyKeyword', () => {
  const MUTATION = `
  mutation DenyKeyword($keyword: String!) {
    denyKeyword(keyword: $keyword) {
      _
    }
  }`;

  it('should not authorize when not moderator', () =>
    testModeratorMutationAuthorization({
      mutation: MUTATION,
      variables: { keyword: 'java' },
    }));

  it('should deny existing keyword', async () => {
    roles = [Roles.Moderator];
    loggedUser = '1';
    await con.getRepository(Keyword).save([{ value: 'java', occurrences: 20 }]);
    const res = await client.mutate({
      mutation: MUTATION,
      variables: { keyword: 'java' },
    });
    expect(res.errors).toBeFalsy();
    const keywords = await con.getRepository(Keyword).find({
      select: ['value', 'status', 'occurrences'],
      order: { value: 'ASC' },
    });
    expect(keywords).toMatchSnapshot();
    expect(mocked(notifyKeywordUpdated).mock.calls[0].slice(1)).toEqual([
      'java',
    ]);
  });

  it('should create a new keyword and deny it', async () => {
    roles = [Roles.Moderator];
    loggedUser = '1';
    const res = await client.mutate({
      mutation: MUTATION,
      variables: { keyword: 'java' },
    });
    expect(res.errors).toBeFalsy();
    const keywords = await con.getRepository(Keyword).find({
      select: ['value', 'status', 'occurrences'],
      order: { value: 'ASC' },
    });
    expect(keywords).toMatchSnapshot();
    expect(mocked(notifyKeywordUpdated).mock.calls[0].slice(1)).toEqual([
      'java',
    ]);
  });
});

describe('mutation setKeywordAsSynonym', () => {
  const MUTATION = `
  mutation SetKeywordAsSynonym($keywordToUpdate: String!, $originalKeyword: String!) {
    setKeywordAsSynonym(keywordToUpdate: $keywordToUpdate, originalKeyword: $originalKeyword) {
      _
    }
  }`;

  it('should not authorize when not moderator', () =>
    testModeratorMutationAuthorization({
      mutation: MUTATION,
      variables: { keywordToUpdate: 'react', originalKeyword: 'reactjs' },
    }));

  it('should set keyword as synonym and rename existing occurrences', async () => {
    roles = [Roles.Moderator];
    loggedUser = '1';
    await con.getRepository(Keyword).save([
      { value: 'reactjs', occurrences: 20, status: 'allow' },
      { value: 'react', occurrences: 100 },
    ]);
    await con.getRepository(PostKeyword).save([
      { postId: 'p1', keyword: 'react' },
      { postId: 'p1', keyword: 'javascript' },
      { postId: 'p2', keyword: 'react' },
      { postId: 'p2', keyword: 'typescript' },
      { postId: 'p3', keyword: 'reactjs' },
    ]);
    const res = await client.mutate({
      mutation: MUTATION,
      variables: { keywordToUpdate: 'react', originalKeyword: 'reactjs' },
    });
    expect(res.errors).toBeFalsy();
    const keywords = await con.getRepository(Keyword).find({
      select: ['value', 'status', 'occurrences'],
      order: { value: 'ASC' },
    });
    const postKeywords = await con.getRepository(PostKeyword).find({
      order: {
        postId: 'ASC',
        keyword: 'ASC',
      },
    });
    expect(keywords).toMatchSnapshot();
    expect(postKeywords).toMatchSnapshot();
    expect(mocked(notifyKeywordUpdated).mock.calls[0].slice(1)).toEqual([
      'reactjs',
    ]);
  });

  it('should create keywords if they do not exist', async () => {
    roles = [Roles.Moderator];
    loggedUser = '1';
    await con.getRepository(PostKeyword).save([
      { postId: 'p1', keyword: 'react' },
      { postId: 'p1', keyword: 'javascript' },
      { postId: 'p2', keyword: 'react' },
      { postId: 'p2', keyword: 'typescript' },
      { postId: 'p3', keyword: 'reactjs' },
    ]);
    const res = await client.mutate({
      mutation: MUTATION,
      variables: { keywordToUpdate: 'react', originalKeyword: 'reactjs' },
    });
    expect(res.errors).toBeFalsy();
    const keywords = await con.getRepository(Keyword).find({
      select: ['value', 'status', 'occurrences'],
      order: { value: 'ASC' },
    });
    const postKeywords = await con.getRepository(PostKeyword).find({
      order: {
        postId: 'ASC',
        keyword: 'ASC',
      },
    });
    expect(keywords).toMatchSnapshot();
    expect(postKeywords).toMatchSnapshot();
    expect(mocked(notifyKeywordUpdated).mock.calls[0].slice(1)).toEqual([
      'reactjs',
    ]);
  });

  it('should ignore duplicates keywords when renaming', async () => {
    roles = [Roles.Moderator];
    loggedUser = '1';
    await con.getRepository(PostKeyword).save([
      { postId: 'p1', keyword: 'react' },
      { postId: 'p1', keyword: 'javascript' },
      { postId: 'p1', keyword: 'reactjs' },
      { postId: 'p2', keyword: 'react' },
      { postId: 'p2', keyword: 'typescript' },
      { postId: 'p3', keyword: 'reactjs' },
    ]);
    const res = await client.mutate({
      mutation: MUTATION,
      variables: { keywordToUpdate: 'react', originalKeyword: 'reactjs' },
    });
    expect(res.errors).toBeFalsy();
    const postKeywords = await con.getRepository(PostKeyword).find({
      order: {
        postId: 'ASC',
        keyword: 'ASC',
      },
    });
    expect(postKeywords).toMatchSnapshot();
    expect(mocked(notifyKeywordUpdated).mock.calls[0].slice(1)).toEqual([
      'reactjs',
    ]);
  });
});
