import {
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  testQueryErrorCode,
} from './helpers';
import { Feed, Organization, User } from '../src/entity';

import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';

import { usersFixture } from './fixture/user';
import { ContentPreferenceOrganization } from '../src/entity/contentPreference/ContentPreferenceOrganization';
import { ContentPreferenceStatus } from '../src/entity/contentPreference/types';
import { OrganizationMemberRoles } from '../src/roles';

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
        role: OrganizationMemberRoles.Owner,
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
        role: OrganizationMemberRoles.Owner,
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
});
