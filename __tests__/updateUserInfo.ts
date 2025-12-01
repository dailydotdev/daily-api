import nock from 'nock';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import {
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  disposeGraphQLTesting,
  MockContext,
} from './helpers';
import { User } from '../src/entity';
import { clearFile, UploadPreset } from '../src/common/cloudinary';
import { fallbackImages } from '../src/config';

let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string;

// Mock cloudinary functions
jest.mock('../src/common/cloudinary', () => ({
  ...(jest.requireActual('../src/common/cloudinary') as Record<
    string,
    unknown
  >),
  clearFile: jest.fn(),
  uploadAvatar: jest
    .fn()
    .mockResolvedValue({ url: 'https://cloudinary.com/avatar.jpg' }),
  uploadProfileCover: jest
    .fn()
    .mockResolvedValue({ url: 'https://cloudinary.com/cover.jpg' }),
}));

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser),
  );
  client = state.client;
});

beforeEach(async () => {
  loggedUser = '1';
  nock.cleanAll();
  jest.clearAllMocks();

  // Save test users
  await con.getRepository(User).save([
    {
      id: '1',
      name: 'Test User',
      username: 'testuser',
      image: 'https://daily.dev/test.jpg',
      createdAt: new Date(),
    },
    {
      id: '2',
      name: 'Another User',
      username: 'anotheruser',
      image: 'https://daily.dev/another.jpg',
      createdAt: new Date(),
    },
  ]);
});

afterAll(() => disposeGraphQLTesting(state));

describe('mutation updateUserInfo', () => {
  const MUTATION = /* GraphQL */ `
    mutation updateUserInfo(
      $data: UpdateUserInfoInput!
      $upload: Upload
      $coverUpload: Upload
    ) {
      updateUserInfo(data: $data, upload: $upload, coverUpload: $coverUpload) {
        id
        name
        image
        cover
        username
        permalink
        bio
        twitter
        github
        hashnode
        createdAt
        infoConfirmed
        timezone
        experienceLevel
        language
        readme
        readmeHtml
        location {
          id
          country
          city
        }
        hideExperience
      }
    }
  `;

  it('should not authorize when not logged in', async () => {
    loggedUser = '';
    const res = await client.mutate(MUTATION, {
      variables: {
        data: {
          name: 'Test User',
          username: 'testuser',
        },
      },
    });

    expect(res.errors).toBeTruthy();
    expect(res.errors[0].extensions?.code).toEqual('UNAUTHENTICATED');
  });

  it('should update user profile with basic fields', async () => {
    loggedUser = '1';
    const repo = con.getRepository(User);
    const user = await repo.findOneBy({ id: loggedUser });

    const res = await client.mutate(MUTATION, {
      variables: {
        data: {
          name: 'Updated Name',
          username: 'newusername',
          bio: 'New bio',
          image: user?.image,
        },
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.updateUserInfo.name).toEqual('Updated Name');
    expect(res.data.updateUserInfo.username).toEqual('newusername');
    expect(res.data.updateUserInfo.bio).toEqual('New bio');

    const updatedUser = await repo.findOneBy({ id: loggedUser });
    expect(updatedUser?.name).toEqual('Updated Name');
    expect(updatedUser?.username).toEqual('newusername');
    expect(updatedUser?.bio).toEqual('New bio');
  });

  it('should update user profile with readme and generate readmeHtml', async () => {
    loggedUser = '1';
    const repo = con.getRepository(User);
    const user = await repo.findOneBy({ id: loggedUser });

    const readme =
      '# Hello World\n\nThis is my **readme** with [a link](https://example.com).';
    expect(user!.readme).toBeNull();
    expect(user!.readmeHtml).toBeNull();

    const res = await client.mutate(MUTATION, {
      variables: {
        data: {
          readme,
          username: 'uuu1',
          name: user!.name,
        },
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.updateUserInfo.readme).toEqual(readme);
    expect(res.data.updateUserInfo.readmeHtml).toBeTruthy();

    const updatedUser = await repo.findOneBy({ id: loggedUser });
    expect(updatedUser!.readme).toEqual(readme);
    expect(updatedUser!.readmeHtml).toContain('<h1>');
    expect(updatedUser!.readmeHtml).toContain('Hello World');
    expect(updatedUser!.readmeHtml).toContain('<strong>');
    expect(updatedUser!.readmeHtml).toContain('readme');
    expect(updatedUser!.readmeHtml).toContain('<a href="https://example.com"');
  });

  it('should update user profile with cover image', async () => {
    loggedUser = '1';
    const repo = con.getRepository(User);
    const user = await repo.findOneBy({ id: loggedUser });

    const cover = 'https://example.com/cover.jpg';
    expect(user!.cover).toBeNull();

    const res = await client.mutate(MUTATION, {
      variables: {
        data: {
          cover,
          username: 'uuu1',
          name: user!.name,
        },
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.updateUserInfo.cover).toEqual(cover);

    const updatedUser = await repo.findOneBy({ id: loggedUser });
    expect(updatedUser!.cover).toEqual(cover);
  });

  it.skip('should update user profile with locationId - requires DatasetLocation records', async () => {
    loggedUser = '1';
    const repo = con.getRepository(User);
    const user = await repo.findOneBy({ id: loggedUser });

    const locationId = 'US-CA-SF';
    expect(user!.locationId).toBeNull();

    const res = await client.mutate(MUTATION, {
      variables: {
        data: {
          locationId,
          username: 'uuu1',
          name: user!.name,
        },
      },
    });

    expect(res.errors).toBeFalsy();
    // Location is a nested object, not directly accessible as locationId
    expect(res.data.updateUserInfo.location).toBeTruthy();
    expect(res.data.updateUserInfo.location.id).toEqual(locationId);

    const updatedUser = await repo.findOneBy({ id: loggedUser });
    expect(updatedUser!.locationId).toEqual(locationId);
  });

  describe('image and cover deletion logic', () => {
    beforeEach(() => {
      jest.mocked(clearFile).mockClear();
    });

    it('should delete avatar when image is set to null', async () => {
      loggedUser = '1';
      const repo = con.getRepository(User);

      // Set user with existing image
      await repo.update(
        { id: loggedUser },
        { image: 'https://example.com/old-avatar.jpg' },
      );

      const res = await client.mutate(MUTATION, {
        variables: {
          data: {
            image: null,
            username: 'uuu1',
            name: 'Test User',
          },
        },
      });

      expect(res.errors).toBeFalsy();

      const updatedUser = await repo.findOneBy({ id: loggedUser });
      expect(updatedUser?.image).toBe(fallbackImages.avatar);
      expect(clearFile).toHaveBeenCalledWith({
        referenceId: loggedUser,
        preset: UploadPreset.Avatar,
      });
    });

    it('should delete cover when cover is set to null', async () => {
      loggedUser = '1';
      const repo = con.getRepository(User);

      // Set user with existing cover
      await repo.update(
        { id: loggedUser },
        { cover: 'https://example.com/old-cover.jpg' },
      );

      const res = await client.mutate(MUTATION, {
        variables: {
          data: {
            cover: null,
            username: 'uuu1',
            name: 'Test User',
          },
        },
      });

      expect(res.errors).toBeFalsy();

      const updatedUser = await repo.findOneBy({ id: loggedUser });
      expect(updatedUser?.cover).toBeNull();
      expect(clearFile).toHaveBeenCalledWith({
        referenceId: loggedUser,
        preset: UploadPreset.ProfileCover,
      });
    });

    it('should delete both image and cover simultaneously', async () => {
      loggedUser = '1';
      const repo = con.getRepository(User);

      // Set user with both image and cover
      await repo.update(
        { id: loggedUser },
        {
          image: 'https://example.com/avatar.jpg',
          cover: 'https://example.com/cover.jpg',
        },
      );

      const res = await client.mutate(MUTATION, {
        variables: {
          data: {
            image: null,
            cover: null,
            username: 'uuu1',
            name: 'Test User',
          },
        },
      });

      expect(res.errors).toBeFalsy();

      const updatedUser = await repo.findOneBy({ id: loggedUser });
      expect(updatedUser?.image).toBe(fallbackImages.avatar);
      expect(updatedUser?.cover).toBeNull();

      expect(clearFile).toHaveBeenCalledTimes(2);
      expect(clearFile).toHaveBeenCalledWith({
        referenceId: loggedUser,
        preset: UploadPreset.Avatar,
      });
      expect(clearFile).toHaveBeenCalledWith({
        referenceId: loggedUser,
        preset: UploadPreset.ProfileCover,
      });
    });

    it('should keep existing image when providing same URL', async () => {
      loggedUser = '1';
      const repo = con.getRepository(User);

      const existingImage = 'https://example.com/avatar.jpg';
      await repo.update({ id: loggedUser }, { image: existingImage });

      const res = await client.mutate(MUTATION, {
        variables: {
          data: {
            image: existingImage,
            username: 'uuu1',
            name: 'Test User',
          },
        },
      });

      expect(res.errors).toBeFalsy();

      const updatedUser = await repo.findOneBy({ id: loggedUser });
      expect(updatedUser?.image).toEqual(existingImage);
      expect(clearFile).not.toHaveBeenCalled();
    });

    it('should keep existing cover when providing same URL', async () => {
      loggedUser = '1';
      const repo = con.getRepository(User);

      const user = await repo.findOneBy({ id: loggedUser });
      const existingCover = 'https://example.com/cover.jpg';
      await repo.update({ id: loggedUser }, { cover: existingCover });

      const res = await client.mutate(MUTATION, {
        variables: {
          data: {
            cover: existingCover,
            image: user?.image, // Preserve existing image
            username: 'uuu1',
            name: 'Test User',
          },
        },
      });

      expect(res.errors).toBeFalsy();

      const updatedUser = await repo.findOneBy({ id: loggedUser });
      expect(updatedUser?.cover).toEqual(existingCover);
      expect(clearFile).not.toHaveBeenCalled();
    });

    it('should not clear image when only updating other fields', async () => {
      loggedUser = '1';
      const repo = con.getRepository(User);

      const existingImage = 'https://example.com/avatar.jpg';
      await repo.update(
        { id: loggedUser },
        { image: existingImage, bio: 'Old bio' },
      );

      const res = await client.mutate(MUTATION, {
        variables: {
          data: {
            bio: 'New bio',
            username: 'uuu1',
            name: 'Test User',
            image: existingImage,
          },
        },
      });

      expect(res.errors).toBeFalsy();

      const updatedUser = await repo.findOneBy({ id: loggedUser });
      expect(updatedUser?.image).toEqual(existingImage);
      expect(updatedUser?.bio).toEqual('New bio');
      expect(clearFile).not.toHaveBeenCalled();
    });

    it('should not clear cover when only updating other fields', async () => {
      loggedUser = '1';
      const repo = con.getRepository(User);

      const user = await repo.findOneBy({ id: loggedUser });
      const existingCover = 'https://example.com/cover.jpg';
      await repo.update(
        { id: loggedUser },
        { cover: existingCover, bio: 'Old bio' },
      );

      const res = await client.mutate(MUTATION, {
        variables: {
          data: {
            bio: 'New bio',
            username: 'uuu1',
            name: 'Test User',
            image: user?.image, // Preserve existing image
            cover: existingCover,
          },
        },
      });

      expect(res.errors).toBeFalsy();

      const updatedUser = await repo.findOneBy({ id: loggedUser });
      expect(updatedUser?.cover).toEqual(existingCover);
      expect(updatedUser?.bio).toEqual('New bio');
      expect(clearFile).not.toHaveBeenCalled();
    });

    it('should not clear image when user has no existing image', async () => {
      loggedUser = '1';
      const repo = con.getRepository(User);

      // Ensure user has no image
      await repo.update({ id: loggedUser }, { image: null });

      const res = await client.mutate(MUTATION, {
        variables: {
          data: {
            image: null,
            username: 'uuu1',
            name: 'Test User',
          },
        },
      });

      expect(res.errors).toBeFalsy();
      expect(clearFile).not.toHaveBeenCalled();
    });

    it('should not clear cover when user has no existing cover', async () => {
      loggedUser = '1';
      const repo = con.getRepository(User);

      // Ensure user has no cover
      const user = await repo.findOneBy({ id: loggedUser });
      await repo.update({ id: loggedUser }, { cover: null });

      const res = await client.mutate(MUTATION, {
        variables: {
          data: {
            cover: null,
            image: user?.image, // Preserve existing image
            username: 'uuu1',
            name: 'Test User',
          },
        },
      });

      expect(res.errors).toBeFalsy();
      expect(clearFile).not.toHaveBeenCalled();
    });
  });

  describe('file uploads', () => {
    it.skip('should handle avatar upload - requires file upload setup', async () => {
      loggedUser = '1';
      const repo = con.getRepository(User);

      process.env.CLOUDINARY_URL = 'cloudinary://test';

      const res = await client.mutate(MUTATION, {
        variables: {
          data: {
            username: 'uuu1',
            name: 'Test User',
          },
          upload: {
            createReadStream: () => 'mock-stream',
            filename: 'avatar.jpg',
            mimetype: 'image/jpeg',
            encoding: 'binary',
          },
        },
      });

      expect(res.errors).toBeFalsy();
      expect(res.data.updateUserInfo.image).toEqual(
        'https://cloudinary.com/avatar.jpg',
      );

      const updatedUser = await repo.findOneBy({ id: loggedUser });
      expect(updatedUser?.image).toEqual('https://cloudinary.com/avatar.jpg');

      delete process.env.CLOUDINARY_URL;
    });

    it.skip('should handle cover upload - requires file upload setup', async () => {
      loggedUser = '1';
      const repo = con.getRepository(User);

      process.env.CLOUDINARY_URL = 'cloudinary://test';

      const res = await client.mutate(MUTATION, {
        variables: {
          data: {
            username: 'uuu1',
            name: 'Test User',
          },
          coverUpload: {
            createReadStream: () => 'mock-stream',
            filename: 'cover.jpg',
            mimetype: 'image/jpeg',
            encoding: 'binary',
          },
        },
      });

      expect(res.errors).toBeFalsy();
      expect(res.data.updateUserInfo.cover).toEqual(
        'https://cloudinary.com/cover.jpg',
      );

      const updatedUser = await repo.findOneBy({ id: loggedUser });
      expect(updatedUser?.cover).toEqual('https://cloudinary.com/cover.jpg');

      delete process.env.CLOUDINARY_URL;
    });

    it.skip('should handle both avatar and cover upload simultaneously - requires file upload setup', async () => {
      loggedUser = '1';
      const repo = con.getRepository(User);

      process.env.CLOUDINARY_URL = 'cloudinary://test';

      const res = await client.mutate(MUTATION, {
        variables: {
          data: {
            username: 'uuu1',
            name: 'Test User',
          },
          upload: {
            createReadStream: () => 'mock-avatar-stream',
            filename: 'avatar.jpg',
            mimetype: 'image/jpeg',
            encoding: 'binary',
          },
          coverUpload: {
            createReadStream: () => 'mock-cover-stream',
            filename: 'cover.jpg',
            mimetype: 'image/jpeg',
            encoding: 'binary',
          },
        },
      });

      expect(res.errors).toBeFalsy();
      expect(res.data.updateUserInfo.image).toEqual(
        'https://cloudinary.com/avatar.jpg',
      );
      expect(res.data.updateUserInfo.cover).toEqual(
        'https://cloudinary.com/cover.jpg',
      );

      const updatedUser = await repo.findOneBy({ id: loggedUser });
      expect(updatedUser?.image).toEqual('https://cloudinary.com/avatar.jpg');
      expect(updatedUser?.cover).toEqual('https://cloudinary.com/cover.jpg');

      delete process.env.CLOUDINARY_URL;
    });
  });

  it('should validate username uniqueness', async () => {
    loggedUser = '1';

    // Create another user with a username
    const repo = con.getRepository(User);
    await repo.save({
      id: '2',
      email: 'user2@example.com',
      username: 'existinguser',
    });

    const res = await client.mutate(MUTATION, {
      variables: {
        data: {
          username: 'existinguser',
          name: 'Test User',
        },
      },
    });

    expect(res.errors).toBeTruthy();
    expect(res.errors[0].message).toContain('username already exists');
  });

  it('should handle all fields together', async () => {
    loggedUser = '1';
    const repo = con.getRepository(User);

    const res = await client.mutate(MUTATION, {
      variables: {
        data: {
          name: 'Full Test User',
          username: 'fulltestuser',
          bio: 'Full bio',
          cover: 'https://example.com/cover.jpg',
          readme: '# My Profile\n\nWelcome!',
          // locationId: 'US-NY-NYC', // Skipped - requires DatasetLocation records
          twitter: 'fulltestuser',
          github: 'fulltestuser',
          portfolio: 'https://fulltestuser.com',
          company: 'Test Company',
          title: 'Test Engineer',
        },
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.updateUserInfo.name).toEqual('Full Test User');
    expect(res.data.updateUserInfo.username).toEqual('fulltestuser');
    expect(res.data.updateUserInfo.bio).toEqual('Full bio');
    expect(res.data.updateUserInfo.cover).toEqual(
      'https://example.com/cover.jpg',
    );
    expect(res.data.updateUserInfo.readme).toEqual('# My Profile\n\nWelcome!');
    expect(res.data.updateUserInfo.readmeHtml).toBeTruthy();
    // Location test skipped - requires DatasetLocation records

    const updatedUser = await repo.findOneBy({ id: loggedUser });
    expect(updatedUser?.name).toEqual('Full Test User');
    expect(updatedUser?.username).toEqual('fulltestuser');
    expect(updatedUser?.bio).toEqual('Full bio');
    expect(updatedUser?.cover).toEqual('https://example.com/cover.jpg');
    expect(updatedUser?.readme).toEqual('# My Profile\n\nWelcome!');
    expect(updatedUser?.readmeHtml).toContain('<h1>');
    // locationId check skipped - requires DatasetLocation records
  });

  it('should update hideExperience', async () => {
    loggedUser = '1';
    const repo = con.getRepository(User);

    // Verify initial state is false
    const user = await repo.findOneBy({ id: loggedUser });
    expect(user?.hideExperience).toBe(false);

    const res = await client.mutate(MUTATION, {
      variables: {
        data: {
          hideExperience: true,
          username: 'testuser',
          name: 'Test User',
        },
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.updateUserInfo.hideExperience).toBe(true);

    const updatedUser = await repo.findOneBy({ id: loggedUser });
    expect(updatedUser?.hideExperience).toBe(true);
  });

  it('should update hideExperience to false', async () => {
    loggedUser = '1';
    const repo = con.getRepository(User);

    // Set hideExperience to true first
    await repo.update({ id: loggedUser }, { hideExperience: true });

    const res = await client.mutate(MUTATION, {
      variables: {
        data: {
          hideExperience: false,
          username: 'testuser',
          name: 'Test User',
        },
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.updateUserInfo.hideExperience).toBe(false);

    const updatedUser = await repo.findOneBy({ id: loggedUser });
    expect(updatedUser?.hideExperience).toBe(false);
  });
});
