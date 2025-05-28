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

import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';

import { userCreatedDate, usersFixture } from './fixture/user';
import { ContentPreferenceOrganization } from '../src/entity/contentPreference/ContentPreferenceOrganization';
import { ContentPreferenceStatus } from '../src/entity/contentPreference/types';
import { OrganizationMemberRole } from '../src/roles';
import type { GQLUserOrganization } from '../src/schema/organizations';
import { updateSubscriptionFlags } from '../src/common';
import assert from 'node:assert';

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

  await saveFixtures(con, User, usersFixture);

  await saveFixtures(con, Organization, [
    {
      id: 'org-1',
      seats: 1,
      name: 'Organization 1',
    },
    {
      id: 'org-2',
      seats: 2,
      name: 'Organization 2',
    },
    {
      id: 'org-3',
      seats: 5,
      name: 'Organization 3',
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
      status: ContentPreferenceStatus.Follow,
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
      status: ContentPreferenceStatus.Follow,
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
        status: ContentPreferenceStatus.Follow,
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
        status: ContentPreferenceStatus.Follow,
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
        role: 'member',
        user: {
          id: '2',
          username: 'tsahidaily',
        },
      },
    ]);
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
        status: ContentPreferenceStatus.Follow,
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
        status: ContentPreferenceStatus.Follow,
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
