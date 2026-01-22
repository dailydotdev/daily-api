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
import { UserWorkspacePhoto } from '../src/entity/user/UserWorkspacePhoto';

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

describe('query userWorkspacePhotos', () => {
  const QUERY = `
    query UserWorkspacePhotos($userId: ID!) {
      userWorkspacePhotos(userId: $userId) {
        edges {
          node {
            id
            image
            position
          }
        }
      }
    }
  `;

  it('should return empty list for user with no photos', async () => {
    const res = await client.query(QUERY, { variables: { userId: '1' } });
    expect(res.data.userWorkspacePhotos.edges).toEqual([]);
  });

  it('should return photos ordered by position', async () => {
    await con.getRepository(UserWorkspacePhoto).save([
      { userId: '1', image: 'https://example.com/photo1.jpg', position: 1 },
      { userId: '1', image: 'https://example.com/photo2.jpg', position: 0 },
    ]);

    const res = await client.query(QUERY, { variables: { userId: '1' } });
    expect(res.data.userWorkspacePhotos.edges).toHaveLength(2);
    expect(res.data.userWorkspacePhotos.edges[0].node.image).toBe(
      'https://example.com/photo2.jpg',
    );
    expect(res.data.userWorkspacePhotos.edges[1].node.image).toBe(
      'https://example.com/photo1.jpg',
    );
  });
});

describe('mutation addUserWorkspacePhoto', () => {
  const MUTATION = `
    mutation AddUserWorkspacePhoto($input: AddUserWorkspacePhotoInput!) {
      addUserWorkspacePhoto(input: $input) {
        id
        image
        position
      }
    }
  `;

  it('should require authentication', async () => {
    const res = await client.mutate(MUTATION, {
      variables: { input: { image: 'https://example.com/photo.jpg' } },
    });
    expect(res.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('should create workspace photo', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: { input: { image: 'https://example.com/photo.jpg' } },
    });

    expect(res.errors).toBeUndefined();
    expect(res.data.addUserWorkspacePhoto).toMatchObject({
      image: 'https://example.com/photo.jpg',
    });
  });

  it('should enforce maximum of 5 photos', async () => {
    loggedUser = '1';
    await con.getRepository(UserWorkspacePhoto).save([
      { userId: '1', image: 'https://example.com/photo1.jpg', position: 0 },
      { userId: '1', image: 'https://example.com/photo2.jpg', position: 1 },
      { userId: '1', image: 'https://example.com/photo3.jpg', position: 2 },
      { userId: '1', image: 'https://example.com/photo4.jpg', position: 3 },
      { userId: '1', image: 'https://example.com/photo5.jpg', position: 4 },
    ]);

    const res = await client.mutate(MUTATION, {
      variables: { input: { image: 'https://example.com/photo6.jpg' } },
    });

    expect(res.errors?.[0]?.message).toBe(
      'Maximum of 5 workspace photos allowed',
    );
  });
});

describe('mutation deleteUserWorkspacePhoto', () => {
  const MUTATION = `
    mutation DeleteUserWorkspacePhoto($id: ID!) {
      deleteUserWorkspacePhoto(id: $id) {
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

  it('should delete photo', async () => {
    loggedUser = '1';
    const photo = await con.getRepository(UserWorkspacePhoto).save({
      userId: '1',
      image: 'https://example.com/photo.jpg',
      position: 0,
    });

    await client.mutate(MUTATION, { variables: { id: photo.id } });

    const deleted = await con
      .getRepository(UserWorkspacePhoto)
      .findOneBy({ id: photo.id });
    expect(deleted).toBeNull();
  });

  it('should not delete other user photo', async () => {
    loggedUser = '1';
    const photo = await con.getRepository(UserWorkspacePhoto).save({
      userId: '2',
      image: 'https://example.com/photo.jpg',
      position: 0,
    });

    await client.mutate(MUTATION, { variables: { id: photo.id } });

    const notDeleted = await con
      .getRepository(UserWorkspacePhoto)
      .findOneBy({ id: photo.id });
    expect(notDeleted).not.toBeNull();
  });
});

describe('mutation reorderUserWorkspacePhotos', () => {
  const MUTATION = `
    mutation ReorderUserWorkspacePhotos($items: [ReorderUserWorkspacePhotoInput!]!) {
      reorderUserWorkspacePhotos(items: $items) {
        id
        position
      }
    }
  `;

  it('should require authentication', async () => {
    const res = await client.mutate(MUTATION, {
      variables: { items: [] },
    });
    expect(res.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('should update positions', async () => {
    loggedUser = '1';
    const [item1, item2] = await con.getRepository(UserWorkspacePhoto).save([
      { userId: '1', image: 'https://example.com/photo1.jpg', position: 0 },
      { userId: '1', image: 'https://example.com/photo2.jpg', position: 1 },
    ]);

    const res = await client.mutate(MUTATION, {
      variables: {
        items: [
          { id: item1.id, position: 1 },
          { id: item2.id, position: 0 },
        ],
      },
    });

    const reordered = res.data.reorderUserWorkspacePhotos;
    expect(
      reordered.find((i: { id: string }) => i.id === item1.id).position,
    ).toBe(1);
    expect(
      reordered.find((i: { id: string }) => i.id === item2.id).position,
    ).toBe(0);
  });

  it('should not reorder other user photos', async () => {
    loggedUser = '1';
    const otherUserPhoto = await con.getRepository(UserWorkspacePhoto).save({
      userId: '2',
      image: 'https://example.com/photo.jpg',
      position: 0,
    });

    await client.mutate(MUTATION, {
      variables: {
        items: [{ id: otherUserPhoto.id, position: 5 }],
      },
    });

    const notUpdated = await con
      .getRepository(UserWorkspacePhoto)
      .findOneBy({ id: otherUserPhoto.id });
    expect(notUpdated?.position).toBe(0);
  });
});
