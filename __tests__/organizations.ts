import assert from 'node:assert';
import { DataSource, In } from 'typeorm';

import {
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  testMutationErrorCode,
  testQueryErrorCode,
} from './helpers';
import { Feed, Organization, User } from '../src/entity';

import createOrGetConnection from '../src/db';

import { userCreatedDate, usersFixture } from './fixture/user';
import {
  ContentPreferenceOrganization,
  ContentPreferenceOrganizationStatus,
} from '../src/entity/contentPreference/ContentPreferenceOrganization';
import { OrganizationMemberRole } from '../src/roles';
import type { GQLUserOrganization } from '../src/schema/organizations';
import { updateSubscriptionFlags } from '../src/common';
import { SubscriptionCycles } from '../src/paddle';
import { SubscriptionStatus } from '../src/common/plus';
import { addHours } from 'date-fns';
import { ioRedisPool, setRedisObject } from '../src/redis';
import { generateStorageKey, StorageKey, StorageTopic } from '../src/config';

let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string | null = null;

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser, []),
  );
  client = state.client;
});

beforeEach(async () => {
  loggedUser = null;
  jest.clearAllMocks();

  await ioRedisPool.execute((client) => client.flushall());

  await saveFixtures(con, User, usersFixture);

  await saveFixtures(con, Organization, [
    {
      id: 'org-1',
      seats: 1,
      name: 'Organization 1',
      subscriptionFlags: {
        cycle: SubscriptionCycles.Yearly,
        status: SubscriptionStatus.Active,
      },
    },
    {
      id: 'org-2',
      seats: 2,
      name: 'Organization 2',
      subscriptionFlags: {
        cycle: SubscriptionCycles.Yearly,
        status: SubscriptionStatus.Cancelled,
      },
    },
    {
      id: 'org-3',
      seats: 5,
      name: 'Organization 3',
      subscriptionFlags: {
        cycle: SubscriptionCycles.Yearly,
        status: SubscriptionStatus.Cancelled,
      },
    },
  ]);
});

describe('query organizations', () => {
  const QUERY = /* GraphQL */ `
    query Organizations {
      organizations {
        role
        referralToken
        organization {
          id
          name
          image
          seats
        }
      }
    }
  `;

  it('should not authorize when not logged-in', () =>
    testQueryErrorCode(client, { query: QUERY }, 'UNAUTHENTICATED'));

  it('should return empty list when member of no organizations', async () => {
    loggedUser = '1';

    const { data } = await client.query(QUERY);
    expect(data).toEqual({
      organizations: [],
    });
  });

  it('should return organizations user is a member of', async () => {
    loggedUser = '1';

    await con.getRepository(Feed).save({
      id: loggedUser,
      userId: loggedUser,
    });

    await con.getRepository(ContentPreferenceOrganization).save({
      userId: loggedUser,
      referenceId: 'org-1',
      organizationId: 'org-1',
      feedId: loggedUser,
      status: ContentPreferenceOrganizationStatus.Plus,
      flags: {
        role: OrganizationMemberRole.Owner,
        referralToken: 'ref-token-1',
      },
    });

    const { data } = await client.query(QUERY);
    expect(data).toEqual({
      organizations: [
        {
          role: 'owner',
          referralToken: 'ref-token-1',
          organization: {
            id: 'org-1',
            name: 'Organization 1',
            image: null,
            seats: 1,
          },
        },
      ],
    });
  });
});

describe('query organization', () => {
  const QUERY = /* GraphQL */ `
    query Organization($id: ID!) {
      organization(id: $id) {
        role
        referralToken
        referralUrl
        organization {
          id
          name
          image
          seats
          members {
            role
            user {
              id
              username
            }
            lastActive
          }
        }
      }
    }
  `;

  it('should not authorize when not logged-in', () =>
    testQueryErrorCode(
      client,
      { query: QUERY, variables: { id: 'org-1' } },
      'UNAUTHENTICATED',
    ));

  it('should return not found when organization does not exist', async () => {
    loggedUser = '1';

    testQueryErrorCode(
      client,
      { query: QUERY, variables: { id: 'non-existing' } },
      'NOT_FOUND',
    );
  });

  it('should return not found when user is not member of organization', async () => {
    loggedUser = '1';

    testQueryErrorCode(
      client,
      { query: QUERY, variables: { id: 'org-1' } },
      'NOT_FOUND',
    );
  });

  it('should return organization user is a member of', async () => {
    loggedUser = '1';

    await con.getRepository(Feed).save({
      id: loggedUser,
      userId: loggedUser,
    });

    await con.getRepository(ContentPreferenceOrganization).save({
      userId: loggedUser,
      referenceId: 'org-1',
      organizationId: 'org-1',
      feedId: loggedUser,
      status: ContentPreferenceOrganizationStatus.Plus,
      flags: {
        role: OrganizationMemberRole.Owner,
        referralToken: 'ref-token-1',
      },
    });

    const { data } = await client.query(QUERY, {
      variables: { id: 'org-1' },
    });
    expect(data).toMatchObject({
      organization: {
        role: 'owner',
        referralToken: 'ref-token-1',
        referralUrl: `${process.env.COMMENTS_PREFIX}/join/organization?token=ref-token-1&orgId=org-1`,
        organization: {
          id: 'org-1',
          name: 'Organization 1',
          seats: 1,
        },
      },
    });
  });

  it('should return members of organization but omit current user', async () => {
    loggedUser = '1';

    await con.getRepository(Feed).save([
      {
        id: loggedUser,
        userId: loggedUser,
      },
      {
        id: '2',
        userId: '2',
      },
    ]);

    await con.getRepository(ContentPreferenceOrganization).save([
      {
        userId: loggedUser,
        referenceId: 'org-1',
        organizationId: 'org-1',
        feedId: loggedUser,
        status: ContentPreferenceOrganizationStatus.Plus,
        flags: {
          role: OrganizationMemberRole.Owner,
          referralToken: 'ref-token-1',
        },
      },
      {
        userId: '2',
        referenceId: 'org-1',
        organizationId: 'org-1',
        feedId: '2',
        status: ContentPreferenceOrganizationStatus.Plus,
        flags: {
          role: OrganizationMemberRole.Member,
          referralToken: 'ref-token-2',
        },
      },
    ]);

    const { data } = await client.query(QUERY, { variables: { id: 'org-1' } });
    const { organization } = data.organization as GQLUserOrganization;

    expect(organization.members).toEqual([
      {
        lastActive: null,
        role: 'member',
        user: {
          id: '2',
          username: 'tsahidaily',
        },
      },
    ]);
  });

  it('should order the members by role and createdAt', async () => {
    loggedUser = '1';

    await con.getRepository(Feed).save([
      {
        id: '1',
        userId: '1',
      },
      {
        id: '2',
        userId: '2',
      },
      {
        id: '3',
        userId: '3',
      },
      {
        id: '4',
        userId: '4',
      },
    ]);

    const now = new Date();

    await con.getRepository(ContentPreferenceOrganization).save([
      {
        userId: '1',
        referenceId: 'org-1',
        organizationId: 'org-1',
        feedId: '1',
        status: ContentPreferenceOrganizationStatus.Plus,
        createdAt: now,
        flags: {
          role: OrganizationMemberRole.Member,
          referralToken: 'ref-token-1',
        },
      },
      {
        userId: '2',
        referenceId: 'org-1',
        organizationId: 'org-1',
        feedId: '2',
        status: ContentPreferenceOrganizationStatus.Plus,
        createdAt: addHours(now, 1),
        flags: {
          role: OrganizationMemberRole.Admin,
          referralToken: 'ref-token-2',
        },
      },
      {
        userId: '3',
        referenceId: 'org-1',
        organizationId: 'org-1',
        feedId: '3',
        status: ContentPreferenceOrganizationStatus.Plus,
        createdAt: addHours(now, 2),
        flags: {
          role: OrganizationMemberRole.Member,
          referralToken: 'ref-token-3',
        },
      },
      {
        userId: '4',
        referenceId: 'org-1',
        organizationId: 'org-1',
        feedId: '4',
        status: ContentPreferenceOrganizationStatus.Plus,
        createdAt: now,
        flags: {
          role: OrganizationMemberRole.Owner,
          referralToken: 'ref-token-4',
        },
      },
    ]);

    const { data, errors } = await client.query<
      { organization: GQLUserOrganization },
      { id: string }
    >(QUERY, { variables: { id: 'org-1' } });

    expect(errors).toBeUndefined();
    expect(
      data.organization.organization.members.map((m) => m.user.id),
    ).toEqual(['4', '2', '3']);
  });

  it('should return lastActive as null if no redis value is set for member', async () => {
    loggedUser = '1';

    await con.getRepository(Feed).save([
      { id: '1', userId: '1' },
      { id: '2', userId: '2' },
    ]);

    await con.getRepository(ContentPreferenceOrganization).save([
      {
        userId: '1',
        referenceId: 'org-1',
        organizationId: 'org-1',
        feedId: '1',
        status: ContentPreferenceOrganizationStatus.Plus,
        flags: {
          role: OrganizationMemberRole.Owner,
          referralToken: 'ref-token-1',
        },
      },
      {
        userId: '2',
        referenceId: 'org-1',
        organizationId: 'org-1',
        feedId: '2',
        status: ContentPreferenceOrganizationStatus.Plus,
        flags: {
          role: OrganizationMemberRole.Member,
          referralToken: 'ref-token-2',
        },
      },
    ]);

    const { data } = await client.query(QUERY, { variables: { id: 'org-1' } });
    const { organization } = data.organization as GQLUserOrganization;
    expect(organization.members[0].lastActive).toBeNull();
  });

  it('should return lastActive as a date if redis value is set for member', async () => {
    loggedUser = '1';

    await con.getRepository(Feed).save([
      { id: '1', userId: '1' },
      { id: '2', userId: '2' },
    ]);

    await con.getRepository(ContentPreferenceOrganization).save([
      {
        userId: '1',
        referenceId: 'org-1',
        organizationId: 'org-1',
        feedId: '1',
        status: ContentPreferenceOrganizationStatus.Plus,
        flags: {
          role: OrganizationMemberRole.Owner,
          referralToken: 'ref-token-1',
        },
      },
      {
        userId: '2',
        referenceId: 'org-1',
        organizationId: 'org-1',
        feedId: '2',
        status: ContentPreferenceOrganizationStatus.Plus,
        flags: {
          role: OrganizationMemberRole.Member,
          referralToken: 'ref-token-2',
        },
      },
    ]);

    // Set redis last activity for user 2
    const lastActiveTimestamp = Date.now();
    await setRedisObject(
      generateStorageKey(StorageTopic.Boot, StorageKey.UserLastOnline, '2'),
      lastActiveTimestamp.toString(),
    );

    const { data } = await client.query(QUERY, { variables: { id: 'org-1' } });
    const { organization } = data.organization as GQLUserOrganization;
    expect(organization.members[0].lastActive).toBe(
      new Date(lastActiveTimestamp).toISOString(),
    );
  });

  it('should handle multiple members with mixed lastActive redis states', async () => {
    loggedUser = '1';

    await con.getRepository(Feed).save([
      { id: '1', userId: '1' },
      { id: '2', userId: '2' },
      { id: '3', userId: '3' },
    ]);

    await con.getRepository(ContentPreferenceOrganization).save([
      {
        userId: '1',
        referenceId: 'org-1',
        organizationId: 'org-1',
        feedId: '1',
        status: ContentPreferenceOrganizationStatus.Plus,
        flags: {
          role: OrganizationMemberRole.Owner,
          referralToken: 'ref-token-1',
        },
      },
      {
        userId: '2',
        referenceId: 'org-1',
        organizationId: 'org-1',
        feedId: '2',
        status: ContentPreferenceOrganizationStatus.Plus,
        flags: {
          role: OrganizationMemberRole.Member,
          referralToken: 'ref-token-2',
        },
      },
      {
        userId: '3',
        referenceId: 'org-1',
        organizationId: 'org-1',
        feedId: '3',
        status: ContentPreferenceOrganizationStatus.Plus,
        flags: {
          role: OrganizationMemberRole.Admin,
          referralToken: 'ref-token-3',
        },
      },
    ]);

    // Set redis last activity for user 2 only
    const lastActiveTimestamp = Date.now();
    await setRedisObject(
      generateStorageKey(StorageTopic.Boot, StorageKey.UserLastOnline, '2'),
      lastActiveTimestamp.toString(),
    );

    const { data } = await client.query(QUERY, { variables: { id: 'org-1' } });
    const { organization } = data.organization as GQLUserOrganization;
    // Find by user id for clarity
    const member2 = organization.members.find((m) => m.user.id === '2');
    const member3 = organization.members.find((m) => m.user.id === '3');
    expect(member2).toBeDefined();
    expect(member3).toBeDefined();
    expect(member2!.lastActive).toBe(
      new Date(lastActiveTimestamp).toISOString(),
    );
    expect(member3!.lastActive).toBeNull();
  });
});

describe('mutation updateOrganization', () => {
  const MUTATION = /* GraphQL */ `
    mutation UpdateOrganization($id: ID!, $name: String, $image: Upload) {
      updateOrganization(id: $id, name: $name, image: $image) {
        organization {
          id
          name
          image
        }
      }
    }
  `;
  beforeEach(async () => {
    await con.getRepository(Feed).save([
      {
        id: '1',
        userId: '1',
      },
      {
        id: '2',
        userId: '2',
      },
    ]);

    await con.getRepository(ContentPreferenceOrganization).save([
      {
        userId: '1',
        referenceId: 'org-1',
        organizationId: 'org-1',
        feedId: '1',
        status: ContentPreferenceOrganizationStatus.Plus,
        flags: {
          role: OrganizationMemberRole.Owner,
          referralToken: 'ref-token-1',
        },
      },
      {
        userId: '2',
        referenceId: 'org-1',
        organizationId: 'org-1',
        feedId: '2',
        status: ContentPreferenceOrganizationStatus.Plus,
        flags: {
          role: OrganizationMemberRole.Member,
          referralToken: 'ref-token-2',
        },
      },
    ]);
  });

  it('should not authorize when not logged-in', () =>
    testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { id: 'org-1', name: 'New org name' } },
      'UNAUTHENTICATED',
    ));

  it('should return not found when organization does not exist', async () => {
    loggedUser = '1';

    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'non-existing', name: 'New org name' },
      },
      'NOT_FOUND',
    );
  });

  it('should return not found when user is not member of organization', async () => {
    loggedUser = '1';

    testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { id: 'org-2', name: 'New org name' } },
      'NOT_FOUND',
    );
  });

  it('should not allow user to update organization when not admin', async () => {
    loggedUser = '2';

    testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { id: 'org-1', name: 'New org name' } },
      'FORBIDDEN',
    );
  });

  it('should allow user to update organization when admin', async () => {
    loggedUser = '1';

    const { data } = await client.mutate(MUTATION, {
      variables: { id: 'org-1', name: 'New org name' },
    });

    expect(data).toEqual({
      updateOrganization: {
        organization: {
          id: 'org-1',
          name: 'New org name',
          image: null,
        },
      },
    });

    const updatedOrg = await con.getRepository(Organization).findOneByOrFail({
      id: 'org-1',
    });
    expect(updatedOrg.name).toBe('New org name');
  });

  it('should throw error when updating organization with null name', async () => {
    loggedUser = '1';

    const res = await client.mutate(MUTATION, {
      variables: { id: 'org-1', name: null },
    });

    const errors = res.errors!;

    expect(errors?.length || 0).toEqual(1);
    expect(errors[0].extensions?.code).toEqual('ZOD_VALIDATION_ERROR');
    expect(errors[0].extensions?.issues?.[0].code).toEqual('invalid_type');
    expect(errors[0].extensions?.issues?.[0].message).toEqual(
      'Expected string, received null',
    );
  });

  it('should throw error when updating organization with name as just spaces', async () => {
    loggedUser = '1';

    const res = await client.mutate(MUTATION, {
      variables: { id: 'org-1', name: '    ' },
    });

    const errors = res.errors!;

    expect(errors?.length || 0).toEqual(1);
    expect(errors[0].extensions?.code).toEqual('ZOD_VALIDATION_ERROR');
    expect(errors[0].extensions?.issues?.[0].code).toEqual('too_small');
    expect(errors[0].extensions?.issues?.[0].message).toEqual(
      'Organization name is required',
    );
  });
});

describe('mutation joinOrganization', () => {
  const MUTATION = /* GraphQL */ `
    mutation JoinOrganization($id: ID!, $token: String!) {
      joinOrganization(id: $id, token: $token) {
        role
        referralToken
        organization {
          id
          name
        }
      }
    }
  `;

  beforeEach(async () => {
    await con.getRepository(Feed).save([
      {
        id: '1',
        userId: '1',
      },
      {
        id: '2',
        userId: '2',
      },
      {
        id: '3',
        userId: '3',
      },
    ]);

    await con.getRepository(ContentPreferenceOrganization).save([
      {
        userId: '1',
        referenceId: 'org-1',
        organizationId: 'org-1',
        feedId: '1',
        status: ContentPreferenceOrganizationStatus.Plus,
        flags: {
          role: OrganizationMemberRole.Owner,
          referralToken: 'ref-token-1',
        },
      },
      {
        userId: '2',
        referenceId: 'org-1',
        organizationId: 'org-1',
        feedId: '2',
        status: ContentPreferenceOrganizationStatus.Plus,
        flags: {
          role: OrganizationMemberRole.Member,
          referralToken: 'ref-token-2',
        },
      },
    ]);
  });

  it('should not authorize when not logged-in', () =>
    testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { id: 'org-1', token: 'ref-token-1' } },
      'UNAUTHENTICATED',
    ));

  it('should return forbidden if organization do not match', async () => {
    loggedUser = '3';

    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'non-existing', token: 'ref-token-1' },
      },
      'FORBIDDEN',
      'Invalid invitation token',
    );
  });

  it('should return forbidden if token do not match', async () => {
    loggedUser = '3';

    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'org-1', token: 'non-existing' },
      },
      'FORBIDDEN',
      'Invalid invitation token',
    );
  });

  it('should return forbidden if inviter does not have permission to invite', async () => {
    loggedUser = '3';

    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'org-1', token: 'ref-token-2' },
      },
      'FORBIDDEN',
      'The person who invited you does not have permission to invite you to this organization.',
    );
  });

  it('should allow user to join organization when invited', async () => {
    loggedUser = '3';

    const res = await client.mutate(MUTATION, {
      variables: { id: 'org-1', token: 'ref-token-1' },
    });
    expect(res.data).toMatchObject({
      joinOrganization: {
        role: 'member',
        organization: {
          id: 'org-1',
          name: 'Organization 1',
        },
      },
    });

    const contentPreference = await con
      .getRepository(ContentPreferenceOrganization)
      .findOneByOrFail({
        userId: loggedUser,
        organizationId: 'org-1',
      });

    expect(contentPreference).not.toBeNull();
    expect(contentPreference.organizationId).toBe('org-1');
    expect(contentPreference.flags?.role).toBe(OrganizationMemberRole.Member);

    const user = await con.getRepository(User).findOneByOrFail({
      id: loggedUser,
    });

    expect(user.subscriptionFlags?.organizationId).toBe('org-1');
    expect(user.subscriptionFlags?.cycle).toBe(SubscriptionCycles.Yearly);
  });
});

describe('query getOrganizationByIdAndInviteToken', () => {
  const QUERY = /* GraphQL */ `
    query GetOrganizationByIdAndInviteToken($id: ID!, $token: String!) {
      getOrganizationByIdAndInviteToken(id: $id, token: $token) {
        user {
          id
          name
        }
        organization {
          id
          name
        }
      }
    }
  `;

  beforeEach(async () => {
    await con.getRepository(Feed).save([
      {
        id: '1',
        userId: '1',
      },
      {
        id: '2',
        userId: '2',
      },
      {
        id: '3',
        userId: '3',
      },
    ]);

    await con.getRepository(ContentPreferenceOrganization).save([
      {
        userId: '1',
        referenceId: 'org-1',
        organizationId: 'org-1',
        feedId: '1',
        status: ContentPreferenceOrganizationStatus.Plus,
        flags: {
          role: OrganizationMemberRole.Owner,
          referralToken: 'ref-token-1',
        },
      },
      {
        userId: '2',
        referenceId: 'org-1',
        organizationId: 'org-1',
        feedId: '2',
        status: ContentPreferenceOrganizationStatus.Plus,
        flags: {
          role: OrganizationMemberRole.Member,
          referralToken: 'ref-token-2',
        },
      },
    ]);
  });

  it('should return forbidden if token and organization do not match', async () => {
    loggedUser = '3';

    testQueryErrorCode(
      client,
      {
        query: QUERY,
        variables: { id: 'non-existing', token: 'ref-token-1' },
      },
      'FORBIDDEN',
      'Invalid invitation token',
    );
  });

  it('should return forbidden if inviter does not have permission to invite', async () => {
    loggedUser = '3';

    testQueryErrorCode(
      client,
      {
        query: QUERY,
        variables: { id: 'org-1', token: 'ref-token-2' },
      },
      'FORBIDDEN',
      'The person who invited you does not have permission to invite you to this organization.',
    );
  });

  it('should return organization and user who invited', async () => {
    loggedUser = '3';

    const res = await client.query(QUERY, {
      variables: { id: 'org-1', token: 'ref-token-1' },
    });
    expect(res.data).toMatchObject({
      getOrganizationByIdAndInviteToken: {
        user: {
          id: '1',
          name: 'Ido',
        },
        organization: {
          id: 'org-1',
          name: 'Organization 1',
        },
      },
    });
  });

  it('should return organization and user who invited when not logged in', async () => {
    const res = await client.query(QUERY, {
      variables: { id: 'org-1', token: 'ref-token-1' },
    });
    expect(res.data).toMatchObject({
      getOrganizationByIdAndInviteToken: {
        user: {
          id: '1',
          name: 'Ido',
        },
        organization: {
          id: 'org-1',
          name: 'Organization 1',
        },
      },
    });
  });
});

describe('mutation leaveOrganization', () => {
  const MUTATION = /* GraphQL */ `
    mutation LeaveOrganization($id: ID!) {
      leaveOrganization(id: $id) {
        _
      }
    }
  `;

  beforeEach(async () => {
    await con.getRepository(User).save({
      id: 'org-rem-2',
      bio: null,
      github: 'orgrem2',
      hashnode: null,
      name: 'Ido',
      image: 'https://daily.dev/ido.jpg',
      email: 'org-rem-2@daily.dev',
      createdAt: new Date(userCreatedDate),
      twitter: null,
      username: 'org-rem-2',
      infoConfirmed: true,
    });
    await con.getRepository(Feed).save([
      {
        id: '1',
        userId: '1',
      },
      {
        id: 'org-rem-2',
        userId: 'org-rem-2',
      },
      {
        id: '3',
        userId: '3',
      },
    ]);

    await con.getRepository(ContentPreferenceOrganization).save([
      {
        userId: '1',
        referenceId: 'org-1',
        organizationId: 'org-1',
        feedId: '1',
        status: ContentPreferenceOrganizationStatus.Plus,
        flags: {
          role: OrganizationMemberRole.Owner,
          referralToken: 'ref-token-1',
        },
      },
      {
        userId: 'org-rem-2',
        referenceId: 'org-1',
        organizationId: 'org-1',
        feedId: 'org-rem-2',
        status: ContentPreferenceOrganizationStatus.Plus,
        flags: {
          role: OrganizationMemberRole.Member,
          referralToken: 'ref-token-2',
        },
      },
    ]);
  });

  it('should not authorize when not logged-in', () =>
    testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { id: 'org-1' } },
      'UNAUTHENTICATED',
    ));

  it('should return forbidden logged user not part of organization', async () => {
    loggedUser = '3';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'org-1' },
      },
      'NOT_FOUND',
    );
  });

  it('should return forbidden logged user is admin of organization', async () => {
    loggedUser = '1';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'org-1' },
      },
      'FORBIDDEN',
      "Access denied! Owner can't be removed",
    );
  });

  it('should remove user from organization and reset their plus if seat user', async () => {
    loggedUser = 'org-rem-2';

    await con.getRepository(User).update(
      {
        id: loggedUser,
      },
      {
        subscriptionFlags: updateSubscriptionFlags({
          organizationId: 'org-1',
          cycle: 'yearly',
        }),
      },
    );

    await client.mutate(MUTATION, {
      variables: { id: 'org-1' },
    });

    const contentPreference = await con
      .getRepository(ContentPreferenceOrganization)
      .findOneBy({
        userId: loggedUser,
        organizationId: 'org-1',
      });

    expect(contentPreference).toBeNull();

    const user = await con.getRepository(User).findOneByOrFail({
      id: loggedUser,
    });

    assert(user.subscriptionFlags);
    expect(user.subscriptionFlags.organizationId).toBeNull();
    expect(user.subscriptionFlags.cycle).toBeNull();
  });

  it('should remove user from organization but keep their plus subscription it not a seat user', async () => {
    loggedUser = 'org-rem-2';

    await con.getRepository(User).update(
      {
        id: loggedUser,
      },
      {
        subscriptionFlags: updateSubscriptionFlags({
          cycle: 'yearly',
        }),
      },
    );

    await client.mutate(MUTATION, {
      variables: { id: 'org-1' },
    });

    const contentPreference = await con
      .getRepository(ContentPreferenceOrganization)
      .findOneBy({
        userId: loggedUser,
        organizationId: 'org-1',
      });

    expect(contentPreference).toBeNull();

    const user = await con.getRepository(User).findOneByOrFail({
      id: loggedUser,
    });

    assert(user.subscriptionFlags);
    expect(user.subscriptionFlags.organizationId).toBeUndefined();
    expect(user.subscriptionFlags.cycle).toBe('yearly');
  });
});

describe('mutation deleteOrganization', () => {
  const MUTATION = /* GraphQL */ `
    mutation DeleteOrganization($id: ID!) {
      deleteOrganization(id: $id) {
        _
      }
    }
  `;

  beforeEach(async () => {
    await con.getRepository(Feed).save([
      {
        id: '1',
        userId: '1',
      },
      {
        id: '2',
        userId: '2',
      },
      {
        id: '3',
        userId: '3',
      },
    ]);

    await con.getRepository(ContentPreferenceOrganization).save([
      {
        userId: '1',
        referenceId: 'org-1',
        organizationId: 'org-1',
        feedId: '1',
        status: ContentPreferenceOrganizationStatus.Plus,
        flags: {
          role: OrganizationMemberRole.Owner,
          referralToken: 'ref-token-1',
        },
      },
      {
        userId: '1',
        referenceId: 'org-2',
        organizationId: 'org-2',
        feedId: '1',
        status: ContentPreferenceOrganizationStatus.Plus,
        flags: {
          role: OrganizationMemberRole.Owner,
          referralToken: 'ref-token-1',
        },
      },
      {
        userId: '1',
        referenceId: 'org-3',
        organizationId: 'org-3',
        feedId: '1',
        status: ContentPreferenceOrganizationStatus.Free,
        flags: {
          role: OrganizationMemberRole.Owner,
          referralToken: 'ref-token-1',
        },
      },
      {
        userId: '2',
        referenceId: 'org-1',
        organizationId: 'org-1',
        feedId: '2',
        status: ContentPreferenceOrganizationStatus.Plus,
        flags: {
          role: OrganizationMemberRole.Admin,
          referralToken: 'ref-token-2',
        },
      },
    ]);
  });

  it('should not authorize when not logged-in', () =>
    testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { id: 'org-1' } },
      'UNAUTHENTICATED',
    ));

  it('should return forbidden logged user not part of organization', async () => {
    loggedUser = '3';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'org-1' },
      },
      'NOT_FOUND',
    );
  });

  it('should return forbidden logged user is admin of organization', async () => {
    loggedUser = '2';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'org-1' },
      },
      'FORBIDDEN',
      'Access denied! You need to be a owner or higher to perform this action.',
    );
  });

  it('should return forbidden when trying to delete organization with active subscription', async () => {
    loggedUser = '1';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'org-1' },
      },
      'FORBIDDEN',
      'Cannot delete organization with an active subscription. Please cancel the subscription first.',
    );
  });

  it('should return forbidden when trying to delete organization with active seats', async () => {
    loggedUser = '1';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'org-2' },
      },
      'FORBIDDEN',
      'Cannot delete organization with Plus members. Please remove all Plus members first.',
    );
  });

  it('should delete organization when user is owner and organization has no active subscription or seats', async () => {
    loggedUser = '1';

    const { data, errors } = await client.mutate(MUTATION, {
      variables: { id: 'org-3' },
    });

    expect(errors).toBeUndefined();
    expect(data).toEqual({
      deleteOrganization: {
        _: true,
      },
    });

    const org = await con.getRepository(Organization).findOneBy({
      id: 'org-3',
    });
    expect(org).toBeNull();

    const contentPreference = await con
      .getRepository(ContentPreferenceOrganization)
      .findOneBy({
        userId: loggedUser,
        organizationId: 'org-3',
      });
    expect(contentPreference).toBeNull();
  });
});

describe('mutation removeOrganizationMember', () => {
  const MUTATION = /* GraphQL */ `
    mutation RemoveOrganizationMember($id: ID!, $memberId: String!) {
      removeOrganizationMember(id: $id, memberId: $memberId) {
        organization {
          seats
          activeSeats
          members {
            user {
              id
            }
          }
        }
      }
    }
  `;

  beforeEach(async () => {
    await con.getRepository(Feed).save([
      {
        id: '1',
        userId: '1',
      },
      {
        id: '2',
        userId: '2',
      },
      {
        id: '3',
        userId: '3',
      },
    ]);

    await con.getRepository(ContentPreferenceOrganization).save([
      {
        userId: '1',
        referenceId: 'org-1',
        organizationId: 'org-1',
        feedId: '1',
        status: ContentPreferenceOrganizationStatus.Plus,
        flags: {
          role: OrganizationMemberRole.Owner,
          referralToken: 'ref-token-1',
        },
      },
      {
        userId: '2',
        referenceId: 'org-1',
        organizationId: 'org-1',
        feedId: '2',
        status: ContentPreferenceOrganizationStatus.Plus,
        flags: {
          role: OrganizationMemberRole.Admin,
          referralToken: 'ref-token-2',
        },
      },
      {
        userId: '3',
        referenceId: 'org-1',
        organizationId: 'org-1',
        feedId: '3',
        status: ContentPreferenceOrganizationStatus.Plus,
        flags: {
          role: OrganizationMemberRole.Member,
          referralToken: 'ref-token-3',
        },
      },
    ]);
  });

  it('should not authorize when not logged-in', () =>
    testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { id: 'org-1', memberId: '2' } },
      'UNAUTHENTICATED',
    ));

  it('should return forbidden logged user not part of organization', async () => {
    loggedUser = '1';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'org-2', memberId: '2' },
      },
      'NOT_FOUND',
    );
  });

  it('should return forbidden logged when user is not correct role', async () => {
    loggedUser = '3';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'org-1', memberId: '2' },
      },
      'FORBIDDEN',
      'Access denied! You need to be a admin or higher to perform this action.',
    );
  });

  it('should return forbidden logged when trying to remove yourself', async () => {
    loggedUser = '1';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'org-1', memberId: '1' },
      },
      'FORBIDDEN',
      'You cannot remove yourself from the organization.',
    );
  });

  it('should return forbidden logged when trying to remove owner', async () => {
    loggedUser = '2';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'org-1', memberId: '1' },
      },
      'FORBIDDEN',
      'You cannot remove the owner of the organization.',
    );
  });

  it('should remove member from organization', async () => {
    loggedUser = '1';

    await con.getRepository(User).update('3', {
      subscriptionFlags: {
        organizationId: 'org-1',
      },
    });

    const { data, errors } = await client.mutate<
      {
        removeOrganizationMember: GQLUserOrganization;
      },
      { id: string; memberId: string }
    >(MUTATION, {
      variables: { id: 'org-1', memberId: '3' },
    });

    expect(errors).toBeUndefined();
    expect(data.removeOrganizationMember.organization.activeSeats).toEqual(2);
    expect(data.removeOrganizationMember.organization.members[0]).toEqual({
      user: {
        id: '2',
      },
    });
  });
});

describe('mutation updateOrganizationMemberRole', () => {
  const MUTATION = /* GraphQL */ `
    mutation UpdateOrganizationMemberRole(
      $id: ID!
      $memberId: String!
      $role: OrganizationMemberRole!
    ) {
      updateOrganizationMemberRole(id: $id, memberId: $memberId, role: $role) {
        organization {
          members {
            role
            user {
              id
            }
          }
        }
      }
    }
  `;

  beforeEach(async () => {
    await saveFixtures(con, Feed, [
      {
        id: '1',
        userId: '1',
      },
      {
        id: '2',
        userId: '2',
      },
      {
        id: '3',
        userId: '3',
      },
      {
        id: '4',
        userId: '4',
      },
    ]);

    await saveFixtures(con, ContentPreferenceOrganization, [
      {
        userId: '1',
        referenceId: 'org-1',
        organizationId: 'org-1',
        feedId: '1',
        status: ContentPreferenceOrganizationStatus.Plus,
        flags: {
          role: OrganizationMemberRole.Owner,
          referralToken: 'ref-token-1',
        },
      },
      {
        userId: '2',
        referenceId: 'org-1',
        organizationId: 'org-1',
        feedId: '2',
        status: ContentPreferenceOrganizationStatus.Plus,
        flags: {
          role: OrganizationMemberRole.Admin,
          referralToken: 'ref-token-2',
        },
      },
      {
        userId: '3',
        referenceId: 'org-1',
        organizationId: 'org-1',
        feedId: '3',
        status: ContentPreferenceOrganizationStatus.Plus,
        flags: {
          role: OrganizationMemberRole.Member,
          referralToken: 'ref-token-3',
        },
      },
      {
        userId: '4',
        referenceId: 'org-2',
        organizationId: 'org-2',
        feedId: '4',
        status: ContentPreferenceOrganizationStatus.Plus,
        flags: {
          role: OrganizationMemberRole.Member,
          referralToken: 'ref-token-4',
        },
      },
    ]);
  });

  it('should not authorize when not logged-in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'org-1', memberId: '2', role: 'admin' },
      },
      'UNAUTHENTICATED',
    ));

  it('should return forbidden logged user not part of organization', async () => {
    loggedUser = '1';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'org-2', memberId: '2', role: 'admin' },
      },
      'NOT_FOUND',
    );
  });

  it('should return forbidden when trying to update role of member not in organization', async () => {
    loggedUser = '1';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'org-1', memberId: '4', role: 'admin' },
      },
      'NOT_FOUND',
    );
  });

  it('should return forbidden logged when user is not correct role', async () => {
    loggedUser = '3';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'org-1', memberId: '2', role: 'admin' },
      },
      'FORBIDDEN',
      'Access denied! You need to be a admin or higher to perform this action.',
    );
  });

  it('should return forbidden logged when trying to update yourself', async () => {
    loggedUser = '1';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'org-1', memberId: '1', role: 'admin' },
      },
      'FORBIDDEN',
      'You cannot change your own role in the organization.',
    );
  });

  it('should return forbidden logged when trying to update owner role', async () => {
    loggedUser = '2';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'org-1', memberId: '1', role: 'admin' },
      },
      'FORBIDDEN',
      'You cannot change the role of the owner of the organization.',
    );
  });

  it('should return forbidden when trying to assign owner role to member', async () => {
    loggedUser = '1';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'org-1', memberId: '3', role: 'owner' },
      },
      'FORBIDDEN',
      'You cannot assign the owner role to a member at this time.',
    );
  });

  it('should update member role to admin', async () => {
    loggedUser = '1';

    const { data, errors } = await client.mutate<
      { updateOrganizationMemberRole: GQLUserOrganization },
      { id: string; memberId: string; role: string }
    >(MUTATION, {
      variables: { id: 'org-1', memberId: '3', role: 'admin' },
    });

    expect(errors).toBeUndefined();
    expect(data.updateOrganizationMemberRole.organization.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'admin',
          user: {
            id: '3',
          },
        }),
        expect.objectContaining({
          role: 'admin',
          user: {
            id: '2',
          },
        }),
      ]),
    );
  });

  it('should update member role to member', async () => {
    loggedUser = '1';

    const { data, errors } = await client.mutate<
      { updateOrganizationMemberRole: GQLUserOrganization },
      { id: string; memberId: string; role: string }
    >(MUTATION, {
      variables: { id: 'org-1', memberId: '2', role: 'member' },
    });

    expect(errors).toBeUndefined();
    expect(data.updateOrganizationMemberRole.organization.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'member',
          user: {
            id: '2',
          },
        }),
        expect.objectContaining({
          role: 'member',
          user: {
            id: '2',
          },
        }),
      ]),
    );
  });
});

describe('mutation toggleOrganizationMemberSeat', () => {
  const MUTATION = /* GraphQL */ `
    mutation ToggleOrganizationMemberSeat($id: ID!, $memberId: String!) {
      toggleOrganizationMemberSeat(id: $id, memberId: $memberId) {
        organization {
          seats
          activeSeats
          members {
            role
            seatType
            user {
              id
              isPlus
            }
          }
        }
      }
    }
  `;

  beforeEach(async () => {
    await con.getRepository(Feed).save([
      {
        id: '1',
        userId: '1',
      },
      {
        id: '2',
        userId: '2',
      },
      {
        id: '3',
        userId: '3',
      },
      {
        id: '4',
        userId: '4',
      },
    ]);

    await con.getRepository(ContentPreferenceOrganization).save([
      {
        userId: '1',
        referenceId: 'org-1',
        organizationId: 'org-1',
        feedId: '1',
        status: ContentPreferenceOrganizationStatus.Plus,
        flags: {
          role: OrganizationMemberRole.Owner,
          referralToken: 'ref-token-1',
        },
      },
      {
        userId: '2',
        referenceId: 'org-1',
        organizationId: 'org-1',
        feedId: '2',
        status: ContentPreferenceOrganizationStatus.Free,
        flags: {
          role: OrganizationMemberRole.Member,
          referralToken: 'ref-token-2',
        },
      },
      {
        userId: '3',
        referenceId: 'org-1',
        organizationId: 'org-1',
        feedId: '3',
        status: ContentPreferenceOrganizationStatus.Plus,
        flags: {
          role: OrganizationMemberRole.Admin,
          referralToken: 'ref-token-2',
        },
      },
      {
        userId: '4',
        referenceId: 'org-2',
        organizationId: 'org-2',
        feedId: '4',
        status: ContentPreferenceOrganizationStatus.Plus,
        flags: {
          role: OrganizationMemberRole.Member,
          referralToken: 'ref-token-3',
        },
      },
    ]);
  });

  it('should not authorize when not logged-in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'org-1', memberId: '2' },
      },
      'UNAUTHENTICATED',
    ));

  it('should return forbidden logged user not part of organization', async () => {
    loggedUser = '1';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'org-2', memberId: '2' },
      },
      'NOT_FOUND',
    );
  });

  it('should return forbidden when trying to update role of member not in organization', async () => {
    loggedUser = '1';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'org-1', memberId: '4' },
      },
      'NOT_FOUND',
    );
  });

  it('should return forbidden when user is not correct role and trying to toggle plus', async () => {
    loggedUser = '2';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'org-1', memberId: '1' },
      },
      'FORBIDDEN',
      'Access denied! You need to be a admin or higher to perform this action.',
    );
  });

  it('should return forbidden when trying to toggle plus on user who has subscription outside of organization', async () => {
    loggedUser = '1';

    await con.getRepository(User).update('2', {
      subscriptionFlags: updateSubscriptionFlags({
        organizationId: 'org-2',
        cycle: 'yearly',
      }),
    });

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'org-1', memberId: '2' },
      },
      'FORBIDDEN',
      'You cannot toggle the seat of a member who has a Plus subscription from outside the organization.',
    );
  });

  it('should return forbidden when trying to assign seat when no seats are available', async () => {
    loggedUser = '1';

    await con.getRepository(Organization).update('org-1', {
      seats: 1,
    });

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'org-1', memberId: '2' },
      },
      'FORBIDDEN',
      'You cannot assign a seat to a member when the organization has reached its maximum number of seats.',
    );
  });

  it('should assign seat to member when seats are available', async () => {
    loggedUser = '1';

    await con.getRepository(Organization).update('org-1', {
      seats: 5,
    });

    await con.getRepository(User).update('3', {
      subscriptionFlags: updateSubscriptionFlags({
        organizationId: 'org-1',
        cycle: 'yearly',
      }),
    });

    const { data, errors } = await client.mutate<
      { toggleOrganizationMemberSeat: GQLUserOrganization },
      { id: string; memberId: string }
    >(MUTATION, {
      variables: { id: 'org-1', memberId: '2' },
    });

    expect(errors).toBeUndefined();
    expect(data.toggleOrganizationMemberSeat.organization.activeSeats).toEqual(
      3,
    );
    expect(data.toggleOrganizationMemberSeat.organization.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'member',
          seatType: 'plus',
          user: {
            id: '2',
            isPlus: true,
          },
        }),
        expect.objectContaining({
          role: 'admin',
          seatType: 'plus',
          user: {
            id: '3',
            isPlus: true,
          },
        }),
      ]),
    );
  });

  it('should remove seat from member when seats are available', async () => {
    loggedUser = '1';

    await con.getRepository(Organization).update('org-1', {
      seats: 5,
    });

    await con.getRepository(User).update('3', {
      subscriptionFlags: updateSubscriptionFlags({
        organizationId: 'org-1',
        cycle: 'yearly',
      }),
    });

    const { data, errors } = await client.mutate<
      { toggleOrganizationMemberSeat: GQLUserOrganization },
      { id: string; memberId: string }
    >(MUTATION, {
      variables: { id: 'org-1', memberId: '3' },
    });

    console.log(JSON.stringify(data.toggleOrganizationMemberSeat, null, 2));

    expect(errors).toBeUndefined();
    expect(data.toggleOrganizationMemberSeat.organization.activeSeats).toEqual(
      1,
    );
    expect(data.toggleOrganizationMemberSeat.organization.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'member',
          seatType: 'free',
          user: {
            id: '2',
            isPlus: false,
          },
        }),
        expect.objectContaining({
          role: 'admin',
          seatType: 'free',
          user: {
            id: '3',
            isPlus: false,
          },
        }),
      ]),
    );
  });

  it('should assign seat to self when not a seat user', async () => {
    loggedUser = '1';

    await con.getRepository(Organization).update('org-1', {
      seats: 5,
    });

    await con.getRepository(User).update(
      {
        id: In(['1', '3']),
      },
      {
        subscriptionFlags: updateSubscriptionFlags({
          organizationId: 'org-1',
          cycle: 'yearly',
        }),
      },
    );

    const { data, errors } = await client.mutate<
      { toggleOrganizationMemberSeat: GQLUserOrganization },
      { id: string; memberId: string }
    >(MUTATION, {
      variables: { id: 'org-1', memberId: '1' },
    });

    expect(errors).toBeUndefined();
    expect(data.toggleOrganizationMemberSeat.organization.activeSeats).toEqual(
      1,
    );
    expect(data.toggleOrganizationMemberSeat.organization.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'member',
          seatType: 'free',
          user: {
            id: '2',
            isPlus: false,
          },
        }),
        expect.objectContaining({
          role: 'admin',
          seatType: 'plus',
          user: {
            id: '3',
            isPlus: true,
          },
        }),
      ]),
    );
  });
});
