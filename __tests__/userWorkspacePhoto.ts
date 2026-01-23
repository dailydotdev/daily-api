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
import {
  ContentImage,
  ContentImageUsedByType,
} from '../src/entity/ContentImage';

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

  it('should add workspace photo and mark ContentImage as used', async () => {
    loggedUser = '1';
    await con.getRepository(ContentImage).save({
      url: 'https://example.com/photo.jpg',
      serviceId: 'test-service-id',
    });

    const res = await client.mutate(MUTATION, {
      variables: { input: { image: 'https://example.com/photo.jpg' } },
    });

    expect(res.errors).toBeUndefined();
    expect(res.data.addUserWorkspacePhoto.image).toBe(
      'https://example.com/photo.jpg',
    );

    const contentImage = await con
      .getRepository(ContentImage)
      .findOneBy({ url: 'https://example.com/photo.jpg' });
    expect(contentImage?.usedByType).toBe(
      ContentImageUsedByType.WorkspacePhoto,
    );
  });

  it('should enforce max 5 photos limit', async () => {
    loggedUser = '1';
    await con.getRepository(UserWorkspacePhoto).save(
      Array.from({ length: 5 }, (_, i) => ({
        userId: '1',
        image: `https://example.com/photo${i}.jpg`,
        position: i,
      })),
    );

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
      image: 'https://example.com/delete-me.jpg',
      position: 0,
    });
    await con.getRepository(ContentImage).save({
      url: 'https://example.com/delete-me.jpg',
      serviceId: 'test-service-id',
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
    const contentImage = await con
      .getRepository(ContentImage)
      .findOneBy({ url: 'https://example.com/delete-me.jpg' });
    expect(contentImage).toBeNull();
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
    const [photo1, photo2] = await con.getRepository(UserWorkspacePhoto).save([
      { userId: '1', image: 'https://example.com/a.jpg', position: 0 },
      { userId: '1', image: 'https://example.com/b.jpg', position: 1 },
    ]);

    const res = await client.mutate(MUTATION, {
      variables: {
        items: [
          { id: photo1.id, position: 1 },
          { id: photo2.id, position: 0 },
        ],
      },
    });

    const reordered = res.data.reorderUserWorkspacePhotos;
    expect(
      reordered.find((p: { id: string }) => p.id === photo1.id).position,
    ).toBe(1);
    expect(
      reordered.find((p: { id: string }) => p.id === photo2.id).position,
    ).toBe(0);
  });
});
