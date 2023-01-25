import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  testMutationErrorCode,
  testQueryErrorCode,
} from './helpers';
import {
  Post,
  SharePost,
  Source,
  SourceFeed,
  SourceMember,
  SourceMemberRoles,
  SquadSource,
  User,
} from '../src/entity';
import { FastifyInstance } from 'fastify';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import createOrGetConnection from '../src/db';
import { usersFixture } from './fixture/user';
import { postsFixture } from './fixture/post';
import { createSource } from './fixture/source';

let app: FastifyInstance;
let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string = null;
let premiumUser: boolean;

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser, premiumUser),
  );
  client = state.client;
  app = state.app;
});

beforeEach(async () => {
  loggedUser = null;
  premiumUser = false;
  await con
    .getRepository(Source)
    .save([
      createSource('a', 'A', 'http://a.com'),
      createSource('b', 'B', 'http://b.com'),
    ]);
  await saveFixtures(con, User, usersFixture);
  await con.getRepository(SourceMember).save([
    {
      userId: '1',
      sourceId: 'a',
      role: SourceMemberRoles.Owner,
      referralToken: 'rt',
      createdAt: new Date(2022, 11, 19),
    },
    {
      userId: '2',
      sourceId: 'a',
      role: SourceMemberRoles.Member,
      referralToken: randomUUID(),
      createdAt: new Date(2022, 11, 20),
    },
    {
      userId: '2',
      sourceId: 'b',
      role: SourceMemberRoles.Owner,
      referralToken: randomUUID(),
      createdAt: new Date(2022, 11, 19),
    },
    {
      userId: '3',
      sourceId: 'b',
      role: SourceMemberRoles.Member,
      referralToken: randomUUID(),
      createdAt: new Date(2022, 11, 20),
    },
  ]);
});

afterAll(() => disposeGraphQLTesting(state));

describe('query sources', () => {
  const QUERY = (first = 10): string => `{
  sources(first: ${first}) {
    pageInfo {
      endCursor
      hasNextPage
    }
    edges {
      node {
        id
        name
        image
        public
      }
    }
  }
}`;

  it('should return only public sources', async () => {
    const res = await client.query(QUERY());
    expect(res.data).toMatchSnapshot();
  });

  it('should flag that more pages available', async () => {
    const res = await client.query(QUERY(1));
    expect(res.data).toMatchSnapshot();
  });

  it('should return only active sources', async () => {
    await con.getRepository(Source).save([
      {
        id: 'd',
        active: false,
        name: 'D',
        image: 'http://d.com',
        handle: 'd',
      },
    ]);
    const res = await client.query(QUERY());
    expect(res.data).toMatchSnapshot();
  });
});

describe('query sourceByFeed', () => {
  const QUERY = `
query SourceByFeed($data: String!) {
  sourceByFeed(feed: $data) {
    id
    name
    image
    public
  }
}`;

  it('should not authorize when not logged in', () =>
    testQueryErrorCode(
      client,
      { query: QUERY, variables: { data: 'https://a.com/feed' } },
      'UNAUTHENTICATED',
    ));

  it('should return null when feed does not exist', async () => {
    loggedUser = '1';
    const res = await client.query(QUERY, {
      variables: { data: 'https://a.com/feed' },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.sourceByFeed).toEqual(null);
  });

  it('should return the source', async () => {
    loggedUser = '1';
    await con.getRepository(SourceFeed).save({
      feed: 'https://a.com/feed',
      sourceId: 'a',
    });
    const res = await client.query(QUERY, {
      variables: { data: 'https://a.com/feed' },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.sourceByFeed).toEqual({
      id: 'a',
      name: 'A',
      image: 'http://a.com',
      public: true,
    });
  });
});

describe('query source current member', () => {
  const QUERY = `
query Source($id: ID!) {
  source(id: $id) {
    id
    currentMember {
      role
    }
  }
}
  `;

  it('should return null for annonymous users', async () => {
    const res = await client.query(QUERY, { variables: { id: 'a' } });
    expect(res.data).toMatchSnapshot();
  });

  it(`should return null for user that's not in the source`, async () => {
    loggedUser = '3';
    const res = await client.query(QUERY, { variables: { id: 'a' } });
    expect(res.data).toMatchSnapshot();
  });

  it('should return current member as owner', async () => {
    loggedUser = '1';
    await con
      .getRepository(SourceMember)
      .update({ userId: '1' }, { role: SourceMemberRoles.Owner });
    const res = await client.query(QUERY, { variables: { id: 'a' } });
    expect(res.data).toMatchSnapshot();
  });

  it('should return current member as member', async () => {
    loggedUser = '1';
    await con
      .getRepository(SourceMember)
      .update({ userId: '1' }, { role: SourceMemberRoles.Member });
    const res = await client.query(QUERY, { variables: { id: 'a' } });
    expect(res.data).toMatchSnapshot();
  });
});

describe('query source', () => {
  const QUERY = `
query Source($id: ID!) {
  source(id: $id) {
    id
    name
    image
    public
  }
}
  `;

  it('should not authorize when source does not exist', () =>
    testQueryErrorCode(
      client,
      { query: QUERY, variables: { id: 'notexist' } },
      'NOT_FOUND',
    ));

  it('should not return private source when user is not member', async () => {
    loggedUser = '3';
    await con.getRepository(Source).update({ id: 'a' }, { private: true });
    return testQueryErrorCode(
      client,
      { query: QUERY, variables: { id: 'a' } },
      'FORBIDDEN',
    );
  });

  it('should return source by id', async () => {
    const res = await client.query(QUERY, { variables: { id: 'a' } });
    expect(res.data).toMatchSnapshot();
  });

  it('should return private source to source members', async () => {
    loggedUser = '1';
    await con.getRepository(Source).update({ id: 'a' }, { private: true });
    const res = await client.query(QUERY, { variables: { id: 'a' } });
    expect(res.errors).toBeFalsy();
    expect(res.data.source.id).toEqual('a');
  });

  it('should return source by handle', async () => {
    loggedUser = '1';
    await con.getRepository(Source).update({ id: 'a' }, { handle: 'handle' });
    const res = await client.query(QUERY, { variables: { id: 'handle' } });
    expect(res.errors).toBeFalsy();
    expect(res.data.source.id).toEqual('a');
  });
});

describe('query sourceHandleExists', () => {
  const QUERY = `
    query SourceHandleExists($handle: String!) {
      sourceHandleExists(handle: $handle) 
    }
  `;

  const updateHandle = (handle = 'a') =>
    con.getRepository(Source).update({ id: 'a' }, { handle, private: true });

  it('should not authorize when user is not logged in', () =>
    testQueryErrorCode(
      client,
      { query: QUERY, variables: { handle: 'a' } },
      'UNAUTHENTICATED',
    ));

  it('should return false if the source handle is not taken', async () => {
    loggedUser = '3';
    await updateHandle();
    const res = await client.query(QUERY, { variables: { handle: 'aa' } });
    expect(res.data.sourceHandleExists).toBeFalsy();
  });

  it('should return true if the source handle is taken', async () => {
    loggedUser = '3';
    await updateHandle();
    const res = await client.query(QUERY, { variables: { handle: 'a' } });
    expect(res.data.sourceHandleExists).toBeTruthy();
  });

  it('should return true if the source handle is taken considering uppercase characters', async () => {
    loggedUser = '3';
    await updateHandle();
    const res = await client.query(QUERY, { variables: { handle: 'A' } });
    expect(res.data.sourceHandleExists).toBeTruthy();
  });
});

describe('members field', () => {
  const QUERY = `
query Source($id: ID!) {
  source(id: $id) {
    id
    members {
      pageInfo {
        endCursor
        hasNextPage
      }
      edges {
        node {
          user { id }
          source { id }
          role
        }
      }
    }
  }
}
  `;

  it('should return source members', async () => {
    const res = await client.query(QUERY, { variables: { id: 'a' } });
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
  });

  it('should return source members for private source when the user is a member', async () => {
    loggedUser = '1';
    await con.getRepository(Source).update({ id: 'a' }, { private: true });
    const res = await client.query(QUERY, { variables: { id: 'a' } });
    expect(res.errors).toBeFalsy();
    expect(res.data.source.members).toMatchSnapshot();
  });
});

describe('permalink field', () => {
  const QUERY = `
query Source($id: ID!) {
  source(id: $id) {
    permalink
  }
}
  `;

  it('should return source url', async () => {
    const res = await client.query(QUERY, { variables: { id: 'a' } });
    expect(res.errors).toBeFalsy();
    expect(res.data.source.permalink).toEqual(
      'http://localhost:5002/sources/a',
    );
  });

  it('should return squad url', async () => {
    loggedUser = '1';
    await con.getRepository(Source).update({ id: 'a' }, { type: 'squad' });
    const res = await client.query(QUERY, { variables: { id: 'a' } });
    expect(res.errors).toBeFalsy();
    expect(res.data.source.permalink).toEqual('http://localhost:5002/squads/a');
  });
});

describe('membersCount field', () => {
  const QUERY = `
query Source($id: ID!) {
  source(id: $id) {
    membersCount
  }
}
  `;

  it('should return number of members', async () => {
    loggedUser = '1';
    const res = await client.query(QUERY, { variables: { id: 'a' } });
    expect(res.errors).toBeFalsy();
    expect(res.data.source.membersCount).toEqual(2);
  });
});

describe('query sourceMembers', () => {
  const QUERY = `
query SourceMembers($id: ID!) {
  sourceMembers(sourceId: $id) {
    pageInfo {
      endCursor
      hasNextPage
    }
    edges {
      node {
        user { id }
        source { id }
      }
    }
  }
}
  `;

  it('should not authorize when source does not exist', () =>
    testQueryErrorCode(
      client,
      { query: QUERY, variables: { id: 'notexist' } },
      'NOT_FOUND',
    ));

  it('should return source members of public source', async () => {
    const res = await client.query(QUERY, { variables: { id: 'a' } });
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
  });

  it('should return source members of private source when user is a member', async () => {
    loggedUser = '1';
    await con.getRepository(Source).update({ id: 'a' }, { private: true });
    const res = await client.query(QUERY, { variables: { id: 'a' } });
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
  });

  it('should not return source members of private source when user is not a member', async () => {
    loggedUser = '3';
    await con.getRepository(Source).update({ id: 'a' }, { private: true });
    return testQueryErrorCode(
      client,
      { query: QUERY, variables: { id: 'a' } },
      'FORBIDDEN',
    );
  });
});

describe('query mySourceMemberships', () => {
  const QUERY = `
query SourceMemberships {
  mySourceMemberships {
    pageInfo {
      endCursor
      hasNextPage
    }
    edges {
      node {
        user { id }
        source { id }
      }
    }
  }
}
  `;

  it('should not authorize when user is not logged in', () =>
    testQueryErrorCode(client, { query: QUERY }, 'UNAUTHENTICATED'));

  it('should return source memberships', async () => {
    loggedUser = '2';
    const res = await client.query(QUERY);
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
  });
});

describe('query sourceMemberByToken', () => {
  const QUERY = `
query SourceMemberByToken($token: String!) {
  sourceMemberByToken(token: $token) {
    user { id }
    source { id }
  }
}
  `;

  it('should throw not found exception', () =>
    testQueryErrorCode(
      client,
      {
        query: QUERY,
        variables: { token: 'notfound' },
      },
      'NOT_FOUND',
    ));

  it('should return source member', async () => {
    const res = await client.query(QUERY, { variables: { token: 'rt' } });
    expect(res.errors).toBeFalsy();
    expect(res.data.sourceMemberByToken.user.id).toEqual('1');
    expect(res.data.sourceMemberByToken.source.id).toEqual('a');
  });
});

describe('compatibility route /publications', () => {
  it('should return only public sources', async () => {
    const res = await request(app.server).get('/v1/publications').expect(200);
    expect(res.body).toMatchSnapshot();
  });
});

describe('mutation createSquad', () => {
  const MUTATION = `
  mutation CreateSquad($name: String!, $handle: String!, $description: String, $postId: ID!, $commentary: String!) {
  createSquad(name: $name, handle: $handle, description: $description, postId: $postId, commentary: $commentary) {
    id
  }
}`;

  const variables = {
    name: 'Squad',
    handle: 'squad',
    postId: 'p1',
    commentary: 'My comment',
  };

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables,
      },
      'UNAUTHENTICATED',
    ));

  it('should create squad', async () => {
    loggedUser = '1';
    await con.getRepository(Post).save(postsFixture[0]);
    const res = await client.mutate(MUTATION, { variables });
    expect(res.errors).toBeFalsy();
    const newId = res.data.createSquad.id;
    const newSource = await con
      .getRepository(SquadSource)
      .findOneBy({ id: newId });
    expect(newSource.name).toEqual('Squad');
    expect(newSource.handle).toEqual('squad');
    expect(newSource.active).toEqual(false);
    expect(newSource.private).toEqual(true);
    const member = await con.getRepository(SourceMember).findOneBy({
      sourceId: newId,
      userId: '1',
    });
    expect(member.role).toEqual(SourceMemberRoles.Owner);
    const post = await con
      .getRepository(SharePost)
      .findOneBy({ sourceId: newId });
    expect(post.authorId).toEqual('1');
    expect(post.sharedPostId).toEqual('p1');
    expect(post.title).toEqual('My comment');
  });

  it('should throw error on duplicate handles', async () => {
    loggedUser = '1';
    await con.getRepository(SquadSource).save({
      id: randomUUID(),
      handle: variables.handle,
      name: 'Dup squad',
      active: false,
    });
    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should throw error when post does not exist', async () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables },
      'FORBIDDEN',
    );
  });

  it('should throw error when handle is invalid', async () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { ...variables, handle: 'inv()8&*^' } },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should lowercase handle', async () => {
    loggedUser = '1';
    await con.getRepository(Post).save(postsFixture[0]);
    const res = await client.mutate(MUTATION, {
      variables: { ...variables, handle: '@HANDLE' },
    });
    expect(res.errors).toBeFalsy();
    const newId = res.data.createSquad.id;
    const newSource = await con
      .getRepository(SquadSource)
      .findOneBy({ id: newId });
    expect(newSource.handle).toEqual('handle');
  });

  it('should limit name length', async () => {
    loggedUser = '1';
    await con.getRepository(Post).save(postsFixture[0]);
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { ...variables, name: new Array(70).join('a') },
      },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should limit description length', async () => {
    loggedUser = '1';
    await con.getRepository(Post).save(postsFixture[0]);
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { ...variables, description: new Array(260).join('a') },
      },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });
});

describe('mutation editSquad', () => {
  const MUTATION = `
  mutation EditSquad($sourceId: ID!, $name: String!, $handle: String!, $description: String) {
  editSquad(sourceId: $sourceId, name: $name, handle: $handle, description: $description) {
    id
  }
}`;

  const variables = {
    sourceId: 's1',
    handle: 's1',
    name: 'Squad',
    description: null,
  };

  beforeEach(async () => {
    await con.getRepository(SquadSource).save({
      id: 's1',
      handle: 's1',
      name: 'Squad',
      private: true,
    });
    await con.getRepository(SourceMember).save({
      sourceId: 's1',
      userId: '1',
      referralToken: 'rt2',
      role: SourceMemberRoles.Owner,
    });
  });

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables,
      },
      'UNAUTHENTICATED',
    ));

  it('should edit squad', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: { ...variables, name: 'test' },
    });
    expect(res.errors).toBeFalsy();
    const editSource = await con
      .getRepository(SquadSource)
      .findOneBy({ id: variables.sourceId });
    expect(editSource.name).toEqual('test');
  });

  it('should throw error on duplicate handles', async () => {
    loggedUser = '1';
    await con.getRepository(SquadSource).save({
      id: randomUUID(),
      handle: 'existing',
      name: 'Dup squad',
      active: false,
    });
    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { ...variables, handle: 'existing' } },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it(`should throw error if squad doesn't exist`, async () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { ...variables, sourceId: 'fake' } },
      'NOT_FOUND',
    );
  });

  it(`should throw error if user is not the squad owner`, async () => {
    loggedUser = '1';
    await con
      .getRepository(SourceMember)
      .update({ userId: '1' }, { role: SourceMemberRoles.Member });
    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables },
      'FORBIDDEN',
    );
  });
});

describe('mutation leaveSource', () => {
  const MUTATION = `
  mutation LeaveSource($sourceId: ID!) {
  leaveSource(sourceId: $sourceId) {
    _
  }
}`;

  const variables = {
    sourceId: 's1',
  };

  beforeEach(async () => {
    await con.getRepository(SquadSource).save({
      id: 's1',
      handle: 's1',
      name: 'Squad',
      private: true,
    });
    await con.getRepository(SourceMember).save({
      sourceId: 's1',
      userId: '1',
      referralToken: 'rt2',
      role: SourceMemberRoles.Member,
    });
  });

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables,
      },
      'UNAUTHENTICATED',
    ));

  it('should leave squad if user is a member', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, { variables });
    expect(res.errors).toBeFalsy();
    const sourceMembers = await con
      .getRepository(SourceMember)
      .countBy(variables);
    expect(sourceMembers).toEqual(0);
  });

  it('should throw an error is user is the owner', async () => {
    loggedUser = '1';
    await con
      .getRepository(SourceMember)
      .update({ userId: '1' }, { role: SourceMemberRoles.Owner });
    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables },
      'FORBIDDEN',
    );
  });
});

describe('mutation deleteSource', () => {
  const MUTATION = `
  mutation DeleteSource($sourceId: ID!) {
  deleteSource(sourceId: $sourceId) {
    _
  }
}`;

  beforeEach(async () => {
    await con.getRepository(SquadSource).save({
      id: 's1',
      handle: 's1',
      name: 'Squad',
      private: true,
      active: false,
    });
    await con.getRepository(SourceMember).save({
      sourceId: 's1',
      userId: '1',
      referralToken: 'rt2',
      role: SourceMemberRoles.Member,
    });
  });

  const variables = {
    sourceId: 's1',
  };

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables,
      },
      'UNAUTHENTICATED',
    ));

  it('should not delete source if user is not the owner', async () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables },
      'FORBIDDEN',
    );
  });

  it('should delete source and members', async () => {
    loggedUser = '1';
    await con
      .getRepository(SourceMember)
      .update({ userId: '1' }, { role: SourceMemberRoles.Owner });

    const res = await client.mutate(MUTATION, { variables });
    expect(res.errors).toBeFalsy();
    const sourceMembers = await con
      .getRepository(SourceMember)
      .countBy(variables);
    expect(sourceMembers).toEqual(0);
    const source = await con.getRepository(SquadSource).countBy({ id: 's1' });
    expect(source).toEqual(0);
  });
});

describe('mutation joinSource', () => {
  const MUTATION = `
  mutation JoinSource($sourceId: ID!, $token: String) {
  joinSource(sourceId: $sourceId, token: $token) {
    id
  }
}`;

  const variables = {
    sourceId: 's1',
  };

  beforeEach(async () => {
    await con.getRepository(SquadSource).save({
      id: 's1',
      handle: 's1',
      name: 'Squad',
      private: true,
    });
    await con.getRepository(SourceMember).save({
      sourceId: 's1',
      userId: '2',
      referralToken: 'rt2',
      role: SourceMemberRoles.Member,
    });
  });

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables,
      },
      'UNAUTHENTICATED',
    ));

  it('should add member to public squad without token', async () => {
    loggedUser = '1';
    await con.getRepository(Source).update({ id: 's1' }, { private: false });
    const res = await client.mutate(MUTATION, { variables });
    expect(res.errors).toBeFalsy();
    expect(res.data.joinSource.id).toEqual('s1');
    await con.getRepository(SourceMember).findOneByOrFail({
      sourceId: 's1',
      userId: '1',
    });
  });

  it('should add member to private squad with token', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: {
        ...variables,
        token: 'rt2',
      },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.joinSource.id).toEqual('s1');
    await con.getRepository(SourceMember).findOneByOrFail({
      sourceId: 's1',
      userId: '1',
    });
  });

  it('should throw error when joining private squad without token', async () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables },
      'FORBIDDEN',
    );
  });

  it('should throw error when joining private squad with wrong token', async () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          ...variables,
          token: 'rt3',
        },
      },
      'FORBIDDEN',
    );
  });

  it('should throw error when joining non squad source', async () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          sourceId: 'a',
        },
      },
      'FORBIDDEN',
    );
  });

  it('should throw error when source does not exist', async () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          sourceId: 'nope',
        },
      },
      'NOT_FOUND',
    );
  });
});
