import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  Mutation,
  Query,
  saveFixtures,
  testMutationErrorCode,
  testQueryErrorCode,
} from './helpers';
import { Roles } from '../src/roles';
import { ArticlePost, Keyword, PostKeyword, Source } from '../src/entity';
import { sourcesFixture } from './fixture/source';
import { postsFixture } from './fixture/post';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import { updateFlagsStatement } from '../src/common';
import { keywordsFixture } from './fixture/keywords';

let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string = null;
let roles: Roles[] = [];

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser, roles),
  );
  client = state.client;
});

beforeEach(async () => {
  jest.resetAllMocks();
  loggedUser = null;
  roles = [];

  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, ArticlePost, postsFixture);
});

afterAll(() => disposeGraphQLTesting(state));

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
    const res = await client.query(QUERY);
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
    const res = await client.query(QUERY);
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
    const res = await client.query(QUERY, { variables: { query: 'script' } });
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
  });
});

describe('query keyword', () => {
  const QUERY = `
  query Keyword($value: String!) {
    keyword(value: $value) {
      value, status, occurrences, synonym
    }
  }`;

  it('should return keyword', async () => {
    roles = [Roles.Moderator];
    loggedUser = '1';
    await con.getRepository(Keyword).save([
      { value: 'nodejs', status: 'allow', occurrences: 200 },
      { value: 'react', occurrences: 300 },
    ]);
    const res = await client.query(QUERY, { variables: { value: 'nodejs' } });
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
    const res = await client.query(QUERY, { variables: { value: 'go' } });
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
  });

  it('should return synonym', async () => {
    roles = [Roles.Moderator];
    loggedUser = '1';
    await con.getRepository(Keyword).save([
      { value: 'nodejs', status: 'allow', occurrences: 200 },
      { value: 'react', occurrences: 300 },
      {
        value: 'js',
        occurrences: 20,
        status: 'synonym',
        synonym: 'javascript',
      },
    ]);
    const res = await client.query(QUERY, { variables: { value: 'js' } });
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
    const res = await client.mutate(MUTATION, {
      variables: { keyword: 'java' },
    });
    expect(res.errors).toBeFalsy();
    const keywords = await con.getRepository(Keyword).find({
      select: ['value', 'status', 'occurrences'],
      order: { value: 'ASC' },
    });
    expect(keywords).toMatchSnapshot();
  });

  it('should create a new keyword and allow it', async () => {
    roles = [Roles.Moderator];
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: { keyword: 'java' },
    });
    expect(res.errors).toBeFalsy();
    const keywords = await con.getRepository(Keyword).find({
      select: ['value', 'status', 'occurrences'],
      order: { value: 'ASC' },
    });
    expect(keywords).toMatchSnapshot();
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
    const res = await client.mutate(MUTATION, {
      variables: { keyword: 'java' },
    });
    expect(res.errors).toBeFalsy();
    const keywords = await con.getRepository(Keyword).find({
      select: ['value', 'status', 'occurrences'],
      order: { value: 'ASC' },
    });
    expect(keywords).toMatchSnapshot();
  });

  it('should create a new keyword and deny it', async () => {
    roles = [Roles.Moderator];
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: { keyword: 'java' },
    });
    expect(res.errors).toBeFalsy();
    const keywords = await con.getRepository(Keyword).find({
      select: ['value', 'status', 'occurrences'],
      order: { value: 'ASC' },
    });
    expect(keywords).toMatchSnapshot();
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
    const res = await client.mutate(MUTATION, {
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
    const res = await client.mutate(MUTATION, {
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
    const res = await client.mutate(MUTATION, {
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
  });
});

describe('keywords flags field', () => {
  const QUERY = `{
    keyword(value: "react") {
      flags {
        title
        description
        roadmap
      }
    }
  }`;

  beforeEach(async () => {
    await con.getRepository(Keyword).save([
      { value: 'react', status: 'allow', occurrences: 200 },
      { value: 'nodejs', status: 'allow', occurrences: 300 },
      { value: 'go', status: 'allow', occurrences: 100 },
    ]);
  });

  it('should return all the public flags for anonymous user', async () => {
    await con.getRepository(Keyword).update(
      { value: 'react' },
      {
        flags: updateFlagsStatement({
          title: 'React',
          description: 'React is a JS library',
          roadmap: 'frontend',
        }),
      },
    );
    const res = await client.query(QUERY);
    expect(res.errors).toBeFalsy();
    expect(res.data.keyword.flags).toEqual({
      title: 'React',
      description: 'React is a JS library',
      roadmap: 'https://roadmap.sh/frontend?ref=dailydev',
    });
  });

  it('should return null values for unset flags', async () => {
    const res = await client.query(QUERY);
    expect(res.data.keyword.flags).toEqual({
      title: null,
      description: null,
      roadmap: null,
    });
  });

  it('should contain all default values in db query', async () => {
    const keyword = await con
      .getRepository(Keyword)
      .findOneBy({ value: 'react' });
    expect(keyword?.flags).toEqual({});
  });
});

describe('query autocompleteKeywords', () => {
  const QUERY = /* GraphQL */ `
    query AutocompleteKeywords($query: String!, $limit: Int) {
      autocompleteKeywords(query: $query, limit: $limit) {
        keyword
        title
      }
    }
  `;

  beforeEach(async () => {
    await saveFixtures(con, Keyword, keywordsFixture);
  });

  it('should return autocomplete allowed keywords when not logged in', async () => {
    const res = await client.query(QUERY, {
      variables: {
        query: 'dev',
      },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteKeywords).toEqual(
      expect.arrayContaining([
        { keyword: 'webdev', title: 'Web Development' },
        { keyword: 'development', title: null },
      ]),
    );
  });

  it('should return autocomplete results', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: {
        query: 'dev',
      },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteKeywords).toEqual(
      expect.arrayContaining([
        { keyword: 'webdev', title: 'Web Development' },
        { keyword: 'web-development', title: null },
        { keyword: 'development', title: null },
      ]),
    );
  });

  it('should limit autocomplete results', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: {
        query: 'dev',
        limit: 1,
      },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteKeywords).toEqual([
      { keyword: 'development', title: null },
    ]);
  });
});
