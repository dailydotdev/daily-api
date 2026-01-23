import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
} from './helpers';
import { User } from '../src/entity/user/User';
import { usersFixture } from './fixture/user';
import { DatasetGear } from '../src/entity/dataset/DatasetGear';
import { UserGear } from '../src/entity/user/UserGear';

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

afterAll(() => disposeGraphQLTesting(state));

beforeEach(async () => {
  loggedUser = null;
  await saveFixtures(con, User, usersFixture);
});

describe('query userGear', () => {
  const QUERY = `
    query UserGear($userId: ID!) {
      userGear(userId: $userId) {
        edges {
          node {
            id
            position
            gear {
              id
              name
            }
          }
        }
      }
    }
  `;

  it('should return empty list for user with no gear', async () => {
    const res = await client.query(QUERY, { variables: { userId: '1' } });
    expect(res.data.userGear.edges).toEqual([]);
  });

  it('should return gear ordered by position', async () => {
    const gear1 = await con.getRepository(DatasetGear).save({
      name: 'MacBook Pro',
      nameNormalized: 'macbookpro',
    });
    const gear2 = await con.getRepository(DatasetGear).save({
      name: 'Keyboard',
      nameNormalized: 'keyboard',
    });

    await con.getRepository(UserGear).save([
      { userId: '1', gearId: gear1.id, position: 1 },
      { userId: '1', gearId: gear2.id, position: 0 },
    ]);

    const res = await client.query(QUERY, { variables: { userId: '1' } });
    expect(res.data.userGear.edges).toHaveLength(2);
    expect(res.data.userGear.edges[0].node.gear.name).toBe('Keyboard');
    expect(res.data.userGear.edges[1].node.gear.name).toBe('MacBook Pro');
  });
});

describe('query autocompleteGear', () => {
  const QUERY = `
    query AutocompleteGear($query: String!) {
      autocompleteGear(query: $query) {
        id
        name
      }
    }
  `;

  it('should return matching gear', async () => {
    await con.getRepository(DatasetGear).save([
      { name: 'MacBook Pro', nameNormalized: 'macbookpro' },
      { name: 'MacBook Air', nameNormalized: 'macbookair' },
      { name: 'Keyboard', nameNormalized: 'keyboard' },
    ]);

    const res = await client.query(QUERY, { variables: { query: 'macbook' } });
    expect(res.data.autocompleteGear).toHaveLength(2);
  });

  it('should return empty for no matches', async () => {
    const res = await client.query(QUERY, { variables: { query: 'xyz' } });
    expect(res.data.autocompleteGear).toEqual([]);
  });

  it('should return exact match first when searching', async () => {
    await con.getRepository(DatasetGear).save([
      { name: 'Monitor Stand', nameNormalized: 'monitorstand' },
      { name: 'Monitor', nameNormalized: 'monitor' },
      { name: 'Monitor Arm', nameNormalized: 'monitorarm' },
    ]);

    const res = await client.query(QUERY, { variables: { query: 'monitor' } });
    const names = res.data.autocompleteGear.map(
      (g: { name: string }) => g.name,
    );
    expect(names).toContain('Monitor');
    // Exact match should be first
    expect(names[0]).toBe('Monitor');
  });
});

describe('mutation addUserGear', () => {
  const MUTATION = `
    mutation AddUserGear($input: AddUserGearInput!) {
      addUserGear(input: $input) {
        id
        gear {
          name
        }
      }
    }
  `;

  it('should require authentication', async () => {
    const res = await client.mutate(MUTATION, {
      variables: { input: { name: 'MacBook Pro' } },
    });
    expect(res.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('should create gear and dataset entry', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: {
        input: {
          name: 'MacBook Pro',
        },
      },
    });

    expect(res.data.addUserGear.gear.name).toBe('MacBook Pro');

    const dataset = await con
      .getRepository(DatasetGear)
      .findOneBy({ nameNormalized: 'macbookpro' });
    expect(dataset).not.toBeNull();
  });

  it('should reuse existing dataset entry', async () => {
    loggedUser = '1';
    await con.getRepository(DatasetGear).save({
      name: 'Keyboard',
      nameNormalized: 'keyboard',
    });

    await client.mutate(MUTATION, {
      variables: { input: { name: 'Keyboard' } },
    });

    const count = await con.getRepository(DatasetGear).countBy({
      nameNormalized: 'keyboard',
    });
    expect(count).toBe(1);
  });

  it('should prevent duplicate gear', async () => {
    loggedUser = '1';
    await client.mutate(MUTATION, {
      variables: { input: { name: 'Monitor' } },
    });

    const res = await client.mutate(MUTATION, {
      variables: { input: { name: 'Monitor' } },
    });

    expect(res.errors?.[0]?.message).toBe(
      'Gear already exists in your profile',
    );
  });
});

describe('mutation deleteUserGear', () => {
  const MUTATION = `
    mutation DeleteUserGear($id: ID!) {
      deleteUserGear(id: $id) {
        _
      }
    }
  `;

  it('should require authentication', async () => {
    const res = await client.mutate(MUTATION, {
      variables: { id: '00000000-0000-0000-0000-000000000000' },
    });
    expect(res.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('should delete gear', async () => {
    loggedUser = '1';
    const gear = await con.getRepository(DatasetGear).save({
      name: 'Webcam',
      nameNormalized: 'webcam',
    });
    const userGear = await con.getRepository(UserGear).save({
      userId: '1',
      gearId: gear.id,
      position: 0,
    });

    await client.mutate(MUTATION, { variables: { id: userGear.id } });

    const deleted = await con
      .getRepository(UserGear)
      .findOneBy({ id: userGear.id });
    expect(deleted).toBeNull();
  });

  it('should not delete another user gear', async () => {
    loggedUser = '1';
    const gear = await con.getRepository(DatasetGear).save({
      name: 'Mouse',
      nameNormalized: 'mouse',
    });
    const userGear = await con.getRepository(UserGear).save({
      userId: '2', // Different user
      gearId: gear.id,
      position: 0,
    });

    await client.mutate(MUTATION, { variables: { id: userGear.id } });

    // Should still exist because it belongs to user 2
    const notDeleted = await con
      .getRepository(UserGear)
      .findOneBy({ id: userGear.id });
    expect(notDeleted).not.toBeNull();
  });
});

describe('mutation reorderUserGear', () => {
  const MUTATION = `
    mutation ReorderUserGear($items: [ReorderUserGearInput!]!) {
      reorderUserGear(items: $items) {
        id
        position
      }
    }
  `;

  it('should require authentication', async () => {
    const res = await client.mutate(MUTATION, {
      variables: {
        items: [{ id: '00000000-0000-0000-0000-000000000000', position: 0 }],
      },
    });
    expect(res.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('should update positions', async () => {
    loggedUser = '1';
    const gear1 = await con.getRepository(DatasetGear).save({
      name: 'Desk',
      nameNormalized: 'desk',
    });
    const gear2 = await con.getRepository(DatasetGear).save({
      name: 'Chair',
      nameNormalized: 'chair',
    });

    const [item1, item2] = await con.getRepository(UserGear).save([
      { userId: '1', gearId: gear1.id, position: 0 },
      { userId: '1', gearId: gear2.id, position: 1 },
    ]);

    const res = await client.mutate(MUTATION, {
      variables: {
        items: [
          { id: item1.id, position: 1 },
          { id: item2.id, position: 0 },
        ],
      },
    });

    const reordered = res.data.reorderUserGear;
    expect(
      reordered.find((i: { id: string }) => i.id === item1.id).position,
    ).toBe(1);
    expect(
      reordered.find((i: { id: string }) => i.id === item2.id).position,
    ).toBe(0);
  });

  it('should not reorder another user gear', async () => {
    loggedUser = '1';
    const gear = await con.getRepository(DatasetGear).save({
      name: 'Headphones',
      nameNormalized: 'headphones',
    });
    const userGear = await con.getRepository(UserGear).save({
      userId: '2', // Different user
      gearId: gear.id,
      position: 0,
    });

    await client.mutate(MUTATION, {
      variables: {
        items: [{ id: userGear.id, position: 5 }],
      },
    });

    // Position should still be 0 because it belongs to user 2
    const notReordered = await con
      .getRepository(UserGear)
      .findOneBy({ id: userGear.id });
    expect(notReordered?.position).toBe(0);
  });
});
