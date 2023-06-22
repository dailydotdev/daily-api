import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  testMutationError,
  testMutationErrorCode,
  testQueryErrorCode,
} from './helpers';
import {
  Post,
  SharePost,
  Source,
  SourceFeed,
  SourceMember,
  SourceType,
  SquadSource,
  User,
  WelcomePost,
} from '../src/entity';
import { SourceMemberRoles, sourceRoleRank } from '../src/roles';
import { FastifyInstance } from 'fastify';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import createOrGetConnection from '../src/db';
import { usersFixture } from './fixture/user';
import { postsFixture } from './fixture/post';
import { createSource } from './fixture/source';
import { SourcePermissions } from '../src/schema/sources';
import { SourcePermissionErrorKeys } from '../src/errors';
import { WELCOME_POST_TITLE } from '../src/common';
import { DisallowHandle } from '../src/entity/DisallowHandle';

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
      role: SourceMemberRoles.Admin,
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
      role: SourceMemberRoles.Admin,
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
      roleRank
      permissions
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

  it('should return current member as admin', async () => {
    loggedUser = '1';
    await con
      .getRepository(SourceMember)
      .update({ userId: '1' }, { role: SourceMemberRoles.Admin });
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

  it('should return current member as blocked', async () => {
    loggedUser = '1';
    await con
      .getRepository(SourceMember)
      .update({ userId: '1' }, { role: SourceMemberRoles.Blocked });
    const res = await client.query(QUERY, { variables: { id: 'a' } });
    expect(res.data).toMatchSnapshot();
  });

  it('should not return post permission in case memberPostingRank is set above user roleRank', async () => {
    loggedUser = '1';
    await con.getRepository(SquadSource).save({
      id: 'restrictedsquad1',
      handle: 'restrictedsquad1',
      name: 'Restricted Squad',
      memberPostingRank: sourceRoleRank[SourceMemberRoles.Moderator],
    });
    await con.getRepository(SourceMember).save({
      userId: '1',
      sourceId: 'restrictedsquad1',
      role: SourceMemberRoles.Member,
      referralToken: 'restrictedsquadtoken',
      createdAt: new Date(2022, 11, 19),
    });
    const res = await client.query(QUERY, {
      variables: { id: 'restrictedsquad1' },
    });
    expect(
      res.data.source.currentMember.permissions.includes(
        SourcePermissions.Post,
      ),
    ).toBe(false);
  });

  it('should not return invite permission in case memberInviteRank is set above user roleRank', async () => {
    loggedUser = '1';
    await con.getRepository(SquadSource).save({
      id: 'restrictedsquad1',
      handle: 'restrictedsquad1',
      name: 'Restricted Squad',
      memberInviteRank: sourceRoleRank[SourceMemberRoles.Moderator],
    });
    await con.getRepository(SourceMember).save({
      userId: '1',
      sourceId: 'restrictedsquad1',
      role: SourceMemberRoles.Member,
      referralToken: 'restrictedsquadtoken',
      createdAt: new Date(2022, 11, 19),
    });
    const res = await client.query(QUERY, {
      variables: { id: 'restrictedsquad1' },
    });
    expect(
      res.data.source.currentMember.permissions.includes(
        SourcePermissions.Invite,
      ),
    ).toBe(false);
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

  it('should not return private source when user is blocked', async () => {
    loggedUser = '1';
    await con
      .getRepository(SourceMember)
      .update({ userId: '1' }, { role: SourceMemberRoles.Blocked });
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

  it('should throw validation error when the handle did not pass our criteria', async () => {
    loggedUser = '3';
    await updateHandle();
    testQueryErrorCode(
      client,
      { query: QUERY, variables: { handle: 'aa aa' } },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

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

  it('should return true if the source handle is not allowed', async () => {
    loggedUser = '3';
    await con.getRepository(DisallowHandle).save({ value: 'disallow' });
    const res = await client.query(QUERY, {
      variables: { handle: 'disallow' },
    });
    expect(res.data.sourceHandleExists).toBeTruthy();
  });

  it('should return true if the source handle is not allowed without case sensitivity', async () => {
    loggedUser = '3';
    await con.getRepository(DisallowHandle).save({ value: 'disallow' });
    const res = await client.query(QUERY, {
      variables: { handle: 'Disallow' },
    });
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

  it('should exclude blocked members from result', async () => {
    await con
      .getRepository(SourceMember)
      .update({ userId: '2' }, { role: SourceMemberRoles.Blocked });
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
    await con
      .getRepository(Source)
      .update({ id: 'a' }, { type: SourceType.Squad });
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

  it('should return number of members excluding blocked members', async () => {
    await con
      .getRepository(SourceMember)
      .update({ userId: '2' }, { role: SourceMemberRoles.Blocked });
    loggedUser = '1';
    const res = await client.query(QUERY, { variables: { id: 'a' } });
    expect(res.errors).toBeFalsy();
    expect(res.data.source.membersCount).toEqual(1);
  });
});

describe('query sourceMembers', () => {
  const QUERY = `
query SourceMembers($id: ID!, $role: String) {
  sourceMembers(sourceId: $id, role: $role) {
    pageInfo {
      endCursor
      hasNextPage
    }
    edges {
      node {
        role
        roleRank
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

  it('should return source members of public source without blocked members', async () => {
    await con
      .getRepository(SourceMember)
      .update({ userId: '2' }, { role: SourceMemberRoles.Blocked });
    const res = await client.query(QUERY, { variables: { id: 'a' } });
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
  });

  it('should return source members and order by their role', async () => {
    const repo = con.getRepository(SourceMember);
    await repo.update(
      { userId: '3' },
      { role: SourceMemberRoles.Member, sourceId: 'a' },
    );
    const noModRes = await client.query(QUERY, { variables: { id: 'a' } });
    expect(noModRes.errors).toBeFalsy();
    const [noModFirst, noModSecond, noModThird] =
      noModRes.data.sourceMembers.edges;
    expect(noModFirst.node.role).toEqual(SourceMemberRoles.Admin);
    expect(noModSecond.node.role).toEqual(SourceMemberRoles.Member);
    expect(noModThird.node.role).toEqual(SourceMemberRoles.Member);

    await repo.update(
      { userId: '3' },
      { role: SourceMemberRoles.Moderator, sourceId: 'a' },
    );

    const res = await client.query(QUERY, { variables: { id: 'a' } });
    expect(res.errors).toBeFalsy();
    const [first, second, third] = res.data.sourceMembers.edges;
    expect(first.node.role).toEqual(SourceMemberRoles.Admin);
    expect(second.node.role).toEqual(SourceMemberRoles.Moderator);
    expect(third.node.role).toEqual(SourceMemberRoles.Member);
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

  it('should not return blocked source members when user is not a moderator/admin', async () => {
    loggedUser = '2';
    await con
      .getRepository(SourceMember)
      .update(
        { userId: '1', sourceId: 'a' },
        { role: SourceMemberRoles.Blocked },
      );
    return testQueryErrorCode(
      client,
      { query: QUERY, variables: { role: SourceMemberRoles.Blocked, id: 'a' } },
      'FORBIDDEN',
    );
  });

  it('should return blocked users only when user is the admin', async () => {
    loggedUser = '1';
    await con
      .getRepository(SourceMember)
      .update(
        { userId: '2', sourceId: 'a' },
        { role: SourceMemberRoles.Blocked },
      );
    const res = await client.query(QUERY, {
      variables: { role: SourceMemberRoles.Blocked, id: 'a' },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
  });

  it('should return blocked users only when user is a moderator', async () => {
    loggedUser = '1';
    await con
      .getRepository(SourceMember)
      .update(
        { userId: '2', sourceId: 'a' },
        { role: SourceMemberRoles.Blocked },
      );
    await con
      .getRepository(SourceMember)
      .update(
        { userId: '1', sourceId: 'a' },
        { role: SourceMemberRoles.Moderator },
      );
    const res = await client.query(QUERY, {
      variables: { role: SourceMemberRoles.Blocked, id: 'a' },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
  });

  it('should only return referralToken for current logged user', async () => {
    loggedUser = '1';
    const QUERY_WITH_REFERRAL_TOKEN = `
    query SourceMembers($id: ID!, $role: String) {
      sourceMembers(sourceId: $id, role: $role) {
        pageInfo {
          endCursor
          hasNextPage
        }
        edges {
          node {
            role
            roleRank
            user { id }
            source { id }
            referralToken
          }
        }
      }
    }`;
    const res = await client.query(QUERY_WITH_REFERRAL_TOKEN, {
      variables: {
        id: 'a',
      },
    });
    expect(res.errors).toBeFalsy();
    res.data.sourceMembers.edges.forEach(({ node }) => {
      if (node.user.id === loggedUser) {
        expect(node.referralToken).toBeTruthy();
      } else {
        expect(node.referralToken).toBeFalsy();
      }
    });
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
            role
            roleRank
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

  it('should not return source memberships in user is blocked', async () => {
    await con
      .getRepository(SourceMember)
      .update(
        { userId: '2', sourceId: 'a' },
        { role: SourceMemberRoles.Blocked },
      );
    loggedUser = '2';
    const res = await client.query(QUERY);
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
  });
});

describe('query checkUserMembership', () => {
  const QUERY = `
    query CheckUserMembership($userId: ID!, $sourceId: ID!) {
      member: checkUserMembership(memberId: $userId, sourceId: $sourceId) {
        role
      }
    }
  `;

  it('should not authorize when source does not exist', () =>
    testQueryErrorCode(
      client,
      { query: QUERY, variables: { userId: '2', sourceId: 'a' } },
      'UNAUTHENTICATED',
    ));

  it('should return forbidden when user is not a member', async () => {
    loggedUser = '3';
    const params = { userId: '2', sourceId: 'a' };
    await con.getRepository(SourceMember).delete(params);
    await con.getRepository(Source).update({ id: 'a' }, { private: true });

    return testQueryErrorCode(
      client,
      { query: QUERY, variables: params },
      'FORBIDDEN',
    );
  });

  it('should return member', async () => {
    loggedUser = '1';
    const params = { userId: '2', sourceId: 'a' };
    await con
      .getRepository(SourceMember)
      .update(params, { role: SourceMemberRoles.Blocked });
    await con.getRepository(Source).update({ id: 'a' }, { private: true });
    const res = await client.query(QUERY, {
      variables: params,
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.member).toBeTruthy();
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
  mutation CreateSquad($name: String!, $handle: String!, $description: String, $postId: ID!, $commentary: String!, $memberPostingRole: String, $memberInviteRole: String) {
  createSquad(name: $name, handle: $handle, description: $description, postId: $postId, commentary: $commentary, memberPostingRole: $memberPostingRole, memberInviteRole: $memberInviteRole) {
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
    expect(newSource.active).toEqual(true);
    expect(newSource.private).toEqual(true);
    expect(newSource?.memberPostingRank).toEqual(
      sourceRoleRank[SourceMemberRoles.Member],
    );
    expect(newSource?.memberInviteRank).toEqual(
      sourceRoleRank[SourceMemberRoles.Member],
    );
    const member = await con.getRepository(SourceMember).findOneBy({
      sourceId: newId,
      userId: '1',
    });
    expect(member.role).toEqual(SourceMemberRoles.Admin);
    const sharePost = await con
      .getRepository(SharePost)
      .findOneBy({ sourceId: newId });
    expect(sharePost.authorId).toEqual('1');
    expect(sharePost.sharedPostId).toEqual('p1');
    expect(sharePost.title).toEqual('My comment');

    const welcomePost = await con
      .getRepository(WelcomePost)
      .findOneBy({ sourceId: newId });
    expect(welcomePost.authorId).toEqual('1');
    expect(welcomePost.title).toEqual(WELCOME_POST_TITLE);
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

  it('should throw error on disallowed handles', async () => {
    loggedUser = '1';
    await con.getRepository(DisallowHandle).save({
      value: variables.handle,
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

  it('should throw error when invalid role is provided for posting', async () => {
    loggedUser = '1';
    await con.getRepository(Post).save(postsFixture[0]);
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { ...variables, memberPostingRole: 'invalidRole' },
      },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should throw error when null is sent to memberPostingRole', async () => {
    loggedUser = '1';
    await con.getRepository(SquadSource).save({
      id: randomUUID(),
      handle: variables.handle,
      name: 'Dup squad',
      active: false,
      memberPostingRole: null,
    });
    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should create squad with memberPostingRank', async () => {
    loggedUser = '1';
    await con.getRepository(Post).save(postsFixture[0]);
    const res = await client.mutate(MUTATION, {
      variables: {
        ...variables,
        memberPostingRole: SourceMemberRoles.Moderator,
      },
    });
    expect(res.errors).toBeFalsy();
    const newId = res.data.createSquad.id;
    const newSource = await con
      .getRepository(SquadSource)
      .findOneBy({ id: newId });
    expect(newSource.name).toEqual('Squad');
    expect(newSource.handle).toEqual('squad');
    expect(newSource.active).toEqual(true);
    expect(newSource.private).toEqual(true);
    expect(newSource?.memberPostingRank).toEqual(
      sourceRoleRank[SourceMemberRoles.Moderator],
    );
    const member = await con.getRepository(SourceMember).findOneBy({
      sourceId: newId,
      userId: '1',
    });
    expect(member.role).toEqual(SourceMemberRoles.Admin);
    const post = await con
      .getRepository(SharePost)
      .findOneBy({ sourceId: newId });
    expect(post.authorId).toEqual('1');
    expect(post.sharedPostId).toEqual('p1');
    expect(post.title).toEqual('My comment');
  });

  it('should throw error when invalid role is provided for inviting', async () => {
    loggedUser = '1';
    await con.getRepository(Post).save(postsFixture[0]);
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { ...variables, memberInviteRole: 'invalidRole' },
      },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should throw error when null is sent to memberInviteRole', async () => {
    loggedUser = '1';
    await con.getRepository(SquadSource).save({
      id: randomUUID(),
      handle: variables.handle,
      name: 'Dup squad',
      active: false,
      memberInviteRole: null,
    });
    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should create squad with memberInviteRole', async () => {
    loggedUser = '1';
    await con.getRepository(Post).save(postsFixture[0]);
    const res = await client.mutate(MUTATION, {
      variables: {
        ...variables,
        memberInviteRole: SourceMemberRoles.Moderator,
      },
    });
    expect(res.errors).toBeFalsy();
    const newId = res.data.createSquad.id;
    const newSource = await con
      .getRepository(SquadSource)
      .findOneBy({ id: newId });
    expect(newSource.name).toEqual('Squad');
    expect(newSource.handle).toEqual('squad');
    expect(newSource.active).toEqual(true);
    expect(newSource.private).toEqual(true);
    expect(newSource?.memberInviteRank).toEqual(
      sourceRoleRank[SourceMemberRoles.Moderator],
    );
    const member = await con.getRepository(SourceMember).findOneBy({
      sourceId: newId,
      userId: '1',
    });
    expect(member.role).toEqual(SourceMemberRoles.Admin);
    const post = await con
      .getRepository(SharePost)
      .findOneBy({ sourceId: newId });
    expect(post.authorId).toEqual('1');
    expect(post.sharedPostId).toEqual('p1');
    expect(post.title).toEqual('My comment');
  });
});

describe('mutation editSquad', () => {
  const MUTATION = `
  mutation EditSquad($sourceId: ID!, $name: String!, $handle: String!, $description: String, $memberPostingRole: String, $memberInviteRole: String) {
  editSquad(sourceId: $sourceId, name: $name, handle: $handle, description: $description, memberPostingRole: $memberPostingRole, memberInviteRole: $memberInviteRole) {
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
      role: SourceMemberRoles.Admin,
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

  it('should edit squad description with new lines', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: { ...variables, description: 'test \n something more' },
    });
    expect(res.errors).toBeFalsy();
    const editSource = await con
      .getRepository(SquadSource)
      .findOneBy({ id: variables.sourceId });
    expect(editSource.description).toEqual('test \n something more');
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

  it('should throw error on disallow handles', async () => {
    loggedUser = '1';
    await con.getRepository(DisallowHandle).save({
      value: 'existing',
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

  it(`should throw error if user is not the squad admin`, async () => {
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

  it('should throw error when invalid role is provided for posting', async () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { ...variables, memberPostingRole: 'invalidRole' },
      },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should throw error when null is sent to memberPostingRole', async () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { ...variables, memberPostingRole: null },
      },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should edit squad memberPostingRank', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: {
        ...variables,
        memberPostingRole: SourceMemberRoles.Moderator,
      },
    });
    expect(res.errors).toBeFalsy();
    const editSource = await con
      .getRepository(SquadSource)
      .findOneBy({ id: variables.sourceId });
    expect(editSource?.memberPostingRank).toEqual(
      sourceRoleRank[SourceMemberRoles.Moderator],
    );
  });

  it('should leave squad memberPostingRank unchanged if not sent during edit', async () => {
    loggedUser = '1';
    await con
      .getRepository(SquadSource)
      .update(
        { id: 's1' },
        { memberPostingRank: sourceRoleRank[SourceMemberRoles.Moderator] },
      );
    const res = await client.mutate(MUTATION, {
      variables,
    });
    expect(res.errors).toBeFalsy();
    const editSource = await con
      .getRepository(SquadSource)
      .findOneBy({ id: variables.sourceId });
    expect(editSource?.memberPostingRank).toEqual(
      sourceRoleRank[SourceMemberRoles.Moderator],
    );
  });

  it('should leave squad memberPostingRank unchanged when setting other fields', async () => {
    loggedUser = '1';
    await con
      .getRepository(SquadSource)
      .update(
        { id: 's1' },
        { memberPostingRank: sourceRoleRank[SourceMemberRoles.Admin] },
      );
    const res = await client.mutate(MUTATION, {
      variables: { ...variables, name: 'updated name' },
    });
    expect(res.errors).toBeFalsy();
    const editSource = await con
      .getRepository(SquadSource)
      .findOneBy({ id: variables.sourceId });
    expect(editSource?.memberPostingRank).toEqual(
      sourceRoleRank[SourceMemberRoles.Admin],
    );
    expect(editSource?.name).toEqual('updated name');
  });

  it('should throw error when invalid role is provided for inviting', async () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { ...variables, memberInviteRole: 'invalidRole' },
      },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should throw error when null is sent to memberInviteRole', async () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { ...variables, memberInviteRole: null },
      },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should edit squad memberInviteRank', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: {
        ...variables,
        memberInviteRole: SourceMemberRoles.Moderator,
      },
    });
    expect(res.errors).toBeFalsy();
    const editSource = await con
      .getRepository(SquadSource)
      .findOneBy({ id: variables.sourceId });
    expect(editSource?.memberInviteRank).toEqual(
      sourceRoleRank[SourceMemberRoles.Moderator],
    );
  });

  it('should leave squad memberInviteRank unchanged if not sent during edit', async () => {
    loggedUser = '1';
    await con
      .getRepository(SquadSource)
      .update(
        { id: 's1' },
        { memberInviteRank: sourceRoleRank[SourceMemberRoles.Moderator] },
      );
    const res = await client.mutate(MUTATION, {
      variables,
    });
    expect(res.errors).toBeFalsy();
    const editSource = await con
      .getRepository(SquadSource)
      .findOneBy({ id: variables.sourceId });
    expect(editSource?.memberInviteRank).toEqual(
      sourceRoleRank[SourceMemberRoles.Moderator],
    );
  });

  it('should leave squad memberInviteRank unchanged when setting other fields', async () => {
    loggedUser = '1';
    await con
      .getRepository(SquadSource)
      .update(
        { id: 's1' },
        { memberInviteRank: sourceRoleRank[SourceMemberRoles.Admin] },
      );
    const res = await client.mutate(MUTATION, {
      variables: { ...variables, name: 'updated name' },
    });
    expect(res.errors).toBeFalsy();
    const editSource = await con
      .getRepository(SquadSource)
      .findOneBy({ id: variables.sourceId });
    expect(editSource?.memberInviteRank).toEqual(
      sourceRoleRank[SourceMemberRoles.Admin],
    );
    expect(editSource?.name).toEqual('updated name');
  });
});

describe('mutation updateMemberRole', () => {
  const MUTATION = `
    mutation UpdateMemberRole($sourceId: ID!, $memberId: ID!, $role: String!) {
      updateMemberRole(sourceId: $sourceId, memberId: $memberId, role: $role) {
        _
      }
    }
  `;

  beforeEach(async () => {
    await con.getRepository(SourceMember).save({
      userId: '3',
      sourceId: 'a',
      role: SourceMemberRoles.Member,
      referralToken: randomUUID(),
      createdAt: new Date(2022, 11, 20),
    });
  });

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          sourceId: 'a',
          memberId: '2',
          role: SourceMemberRoles.Member,
        },
      },
      'UNAUTHENTICATED',
    ));

  it('should restrict when not a member of the squad', async () => {
    loggedUser = '1';

    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          sourceId: 'b',
          memberId: '2',
          role: SourceMemberRoles.Member,
        },
      },
      'FORBIDDEN',
    );
  });

  it('should restrict member updating another member to a new role', async () => {
    loggedUser = '2';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          sourceId: 'a',
          memberId: '3',
          role: SourceMemberRoles.Moderator,
        },
      },
      'FORBIDDEN',
    );
  });

  it('should restrict moderator updating another member to a new role', async () => {
    loggedUser = '2';
    await con
      .getRepository(SourceMember)
      .update({ userId: '2' }, { role: SourceMemberRoles.Moderator });
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          sourceId: 'a',
          memberId: '3',
          role: SourceMemberRoles.Moderator,
        },
      },
      'FORBIDDEN',
    );
  });

  it('should allow admin to promote a member to moderator', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: {
        sourceId: 'a',
        memberId: '2',
        role: SourceMemberRoles.Moderator,
      },
    });
    expect(res.errors).toBeFalsy();
    const member = await con
      .getRepository(SourceMember)
      .findOneBy({ userId: '2', sourceId: 'a' });
    expect(member.role).toEqual(SourceMemberRoles.Moderator);
  });

  it('should allow admin to promote a moderator to an admin', async () => {
    loggedUser = '1';
    await con
      .getRepository(SourceMember)
      .update({ userId: '2' }, { role: SourceMemberRoles.Moderator });
    const res = await client.mutate(MUTATION, {
      variables: {
        sourceId: 'a',
        memberId: '2',
        role: SourceMemberRoles.Admin,
      },
    });
    expect(res.errors).toBeFalsy();
    const member = await con
      .getRepository(SourceMember)
      .findOneBy({ userId: '2', sourceId: 'a' });
    expect(member.role).toEqual(SourceMemberRoles.Admin);
  });

  it('should allow admin to demote an admin to a moderator', async () => {
    loggedUser = '1';
    await con
      .getRepository(SourceMember)
      .update({ userId: '2' }, { role: SourceMemberRoles.Admin });
    const res = await client.mutate(MUTATION, {
      variables: {
        sourceId: 'a',
        memberId: '2',
        role: SourceMemberRoles.Moderator,
      },
    });
    expect(res.errors).toBeFalsy();
    const member = await con
      .getRepository(SourceMember)
      .findOneBy({ userId: '2', sourceId: 'a' });
    expect(member.role).toEqual(SourceMemberRoles.Moderator);
  });

  it('should allow admin to demote a moderator to a member', async () => {
    loggedUser = '1';
    await con
      .getRepository(SourceMember)
      .update({ userId: '2' }, { role: SourceMemberRoles.Moderator });
    const res = await client.mutate(MUTATION, {
      variables: {
        sourceId: 'a',
        memberId: '2',
        role: SourceMemberRoles.Member,
      },
    });
    expect(res.errors).toBeFalsy();
    const member = await con
      .getRepository(SourceMember)
      .findOneBy({ userId: '2', sourceId: 'a' });
    expect(member.role).toEqual(SourceMemberRoles.Member);
  });

  it('should allow admin to remove and block an admin', async () => {
    loggedUser = '1';
    await con
      .getRepository(SourceMember)
      .update({ userId: '2' }, { role: SourceMemberRoles.Admin });
    const res = await client.mutate(MUTATION, {
      variables: {
        sourceId: 'a',
        memberId: '2',
        role: SourceMemberRoles.Blocked,
      },
    });
    expect(res.errors).toBeFalsy();
    const member = await con
      .getRepository(SourceMember)
      .findOneBy({ userId: '2', sourceId: 'a' });
    expect(member.role).toEqual(SourceMemberRoles.Blocked);
  });

  it('should allow admin to remove and block a moderator', async () => {
    loggedUser = '1';
    await con
      .getRepository(SourceMember)
      .update({ userId: '2' }, { role: SourceMemberRoles.Moderator });
    const res = await client.mutate(MUTATION, {
      variables: {
        sourceId: 'a',
        memberId: '2',
        role: SourceMemberRoles.Blocked,
      },
    });
    expect(res.errors).toBeFalsy();
    const member = await con
      .getRepository(SourceMember)
      .findOneBy({ userId: '2', sourceId: 'a' });
    expect(member.role).toEqual(SourceMemberRoles.Blocked);
  });

  it('should allow admin to remove and block a member', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: {
        sourceId: 'a',
        memberId: '2',
        role: SourceMemberRoles.Blocked,
      },
    });
    expect(res.errors).toBeFalsy();
    const member = await con
      .getRepository(SourceMember)
      .findOneBy({ userId: '2', sourceId: 'a' });
    expect(member.role).toEqual(SourceMemberRoles.Blocked);
  });

  it('should restrict moderator to remove and block a moderator', async () => {
    loggedUser = '2';
    await con
      .getRepository(SourceMember)
      .update({ userId: '2' }, { role: SourceMemberRoles.Moderator });
    await con
      .getRepository(SourceMember)
      .update({ userId: '3' }, { role: SourceMemberRoles.Moderator });
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          sourceId: 'a',
          memberId: '3',
          role: SourceMemberRoles.Blocked,
        },
      },
      'FORBIDDEN',
    );
  });

  it('should restrict moderator to remove and block an admin', async () => {
    loggedUser = '2';
    await con
      .getRepository(SourceMember)
      .update({ userId: '2' }, { role: SourceMemberRoles.Moderator });
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          sourceId: 'a',
          memberId: '1',
          role: SourceMemberRoles.Blocked,
        },
      },
      'FORBIDDEN',
    );
  });

  it('should allow moderator to remove and block a member', async () => {
    loggedUser = '2';
    await con
      .getRepository(SourceMember)
      .update({ userId: '2' }, { role: SourceMemberRoles.Moderator });
    const res = await client.mutate(MUTATION, {
      variables: {
        sourceId: 'a',
        memberId: '3',
        role: SourceMemberRoles.Blocked,
      },
    });
    expect(res.errors).toBeFalsy();
    const member = await con
      .getRepository(SourceMember)
      .findOneBy({ userId: '3', sourceId: 'a' });
    expect(member.role).toEqual(SourceMemberRoles.Blocked);
  });
});

describe('mutation unblockMember', () => {
  const MUTATION = `
    mutation UnblockMember($sourceId: ID!, $memberId: ID!) {
      unblockMember(sourceId: $sourceId, memberId: $memberId) {
        _
      }
    }
  `;

  beforeEach(async () => {
    await con.getRepository(SourceMember).save({
      userId: '3',
      sourceId: 'a',
      role: SourceMemberRoles.Blocked,
      referralToken: randomUUID(),
      createdAt: new Date(2022, 11, 20),
    });
  });

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { sourceId: 'a', memberId: '3' },
      },
      'UNAUTHENTICATED',
    ));

  it('should restrict when not a member of the squad', async () => {
    loggedUser = '1';

    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { sourceId: 'b', memberId: '3' },
      },
      'FORBIDDEN',
    );
  });

  it('should restrict member unblock another member', async () => {
    loggedUser = '2';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { sourceId: 'a', memberId: '3' },
      },
      'FORBIDDEN',
    );
  });

  it('should allow moderator to unblock a member', async () => {
    loggedUser = '2';
    await con
      .getRepository(SourceMember)
      .update({ userId: '2' }, { role: SourceMemberRoles.Moderator });
    const res = await client.mutate(MUTATION, {
      variables: { sourceId: 'a', memberId: '3' },
    });
    expect(res.errors).toBeFalsy();
    const member = await con
      .getRepository(SourceMember)
      .findOneBy({ userId: '3', sourceId: 'a' });
    expect(member).toBeFalsy();
  });

  it('should allow admin to unblock a member', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: { sourceId: 'a', memberId: '3' },
    });
    expect(res.errors).toBeFalsy();
    const member = await con
      .getRepository(SourceMember)
      .findOneBy({ userId: '3', sourceId: 'a' });
    expect(member).toBeFalsy();
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

  it('should leave squad even if the user is the admin', async () => {
    loggedUser = '1';
    await con
      .getRepository(SourceMember)
      .update({ userId: '1' }, { role: SourceMemberRoles.Admin });
    const res = await client.mutate(MUTATION, { variables });
    expect(res.errors).toBeFalsy();
    const sourceMembers = await con
      .getRepository(SourceMember)
      .countBy(variables);
    expect(sourceMembers).toEqual(0);
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

  it('should not delete source if user is not the admin', async () => {
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
      .update({ userId: '1' }, { role: SourceMemberRoles.Admin });

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
      role: SourceMemberRoles.Admin,
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
    await con.getRepository(Source).update({ id: 's1' }, { active: false });
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
    const source = await con.getRepository(Source).findOneBy({ id: 's1' });
    expect(source.active).toEqual(true);
  });

  it('should succeed if an existing member tries to join again', async () => {
    loggedUser = '2';
    await con.getRepository(Source).update({ id: 's1' }, { private: false });
    const res = await client.mutate(MUTATION, { variables });
    expect(res.errors).toBeFalsy();
    expect(res.data.joinSource.id).toEqual('s1');
    const member = await con.getRepository(SourceMember).findOneByOrFail({
      sourceId: 's1',
      userId: '2',
    });
    expect(member.role).toEqual(SourceMemberRoles.Admin);
  });

  it('should throw error when joining private squad without token', async () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables },
      'FORBIDDEN',
    );
  });

  it('should throw error when joining private squad when blocked', async () => {
    loggedUser = '2';
    await con
      .getRepository(SourceMember)
      .update({ userId: '2' }, { role: SourceMemberRoles.Blocked });
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

  it('should throw error when joining with invite link of a member without invite permission', async () => {
    await con.getRepository(SquadSource).save({
      id: 's1',
      handle: 's1',
      name: 'Squad',
      private: true,
      memberInviteRank: sourceRoleRank[SourceMemberRoles.Moderator],
    });
    await con.getRepository(SourceMember).save({
      sourceId: 's1',
      userId: '2',
      referralToken: 'rt2',
      role: SourceMemberRoles.Member,
    });

    loggedUser = '1';
    await testMutationError(
      client,
      {
        mutation: MUTATION,
        variables: {
          sourceId: 's1',
          token: 'rt2',
        },
      },
      (errors) => {
        expect(errors.length).toEqual(1);
        expect(errors[0].extensions?.code).toEqual('FORBIDDEN');
        expect(errors[0].message).toEqual(
          SourcePermissionErrorKeys.InviteInvalid,
        );
      },
    );
  });
});

describe('query source members', () => {
  const QUERY = `
query Source($id: ID!) {
  source(id: $id) {
    id
    privilegedMembers {
      user {
        id
      }
      role
    }
  }
}
  `;

  beforeEach(async () => {
    await con
      .getRepository(Source)
      .save([createSource('c', 'C', 'http://c.com')]);
    await saveFixtures(con, User, usersFixture);
    await con.getRepository(SourceMember).save([
      {
        userId: '1',
        sourceId: 'c',
        role: SourceMemberRoles.Admin,
        referralToken: randomUUID(),
        createdAt: new Date(2022, 11, 19),
      },
      {
        userId: '2',
        sourceId: 'c',
        role: SourceMemberRoles.Moderator,
        referralToken: randomUUID(),
        createdAt: new Date(2022, 11, 20),
      },
      {
        userId: '3',
        sourceId: 'c',
        role: SourceMemberRoles.Moderator,
        referralToken: randomUUID(),
        createdAt: new Date(2022, 11, 19),
      },
      {
        userId: '4',
        sourceId: 'c',
        role: SourceMemberRoles.Member,
        referralToken: randomUUID(),
        createdAt: new Date(2022, 11, 20),
      },
    ]);
  });

  it('should return null for annonymous users', async () => {
    const res = await client.query(QUERY, { variables: { id: 'c' } });
    expect(res.data).toMatchObject({
      source: {
        id: 'c',
        privilegedMembers: null,
      },
    });
  });

  it('should return current members', async () => {
    loggedUser = '1';
    const res = await client.query(QUERY, { variables: { id: 'c' } });
    expect(res.data).toMatchObject({
      source: {
        id: 'c',
        privilegedMembers: [
          {
            role: 'admin',
            user: {
              id: '1',
            },
          },
          {
            role: 'moderator',
            user: {
              id: '2',
            },
          },
          {
            role: 'moderator',
            user: {
              id: '3',
            },
          },
        ],
      },
    });
  });
});
