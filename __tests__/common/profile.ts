import { ForbiddenError } from 'apollo-server-errors';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { ensureProfileComplete } from '../../src/common/profile/completion';
import { User } from '../../src/entity';
import { UserExperience } from '../../src/entity/user/experiences/UserExperience';
import { UserExperienceType } from '../../src/entity/user/experiences/types';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

const addProfileExperience = async (
  userId: string,
  type: UserExperienceType,
): Promise<void> => {
  await con.getRepository(UserExperience).save({
    userId,
    type,
    title: `${type} title`,
    startedAt: new Date(),
  });
};

describe('common/profile completion', () => {
  it('should allow post creation for fully completed profile', async () => {
    await con.getRepository(User).save({
      id: 'complete-user',
      image: 'https://daily.dev/complete-user.jpg',
      bio: 'I ship production code',
      experienceLevel: 'senior',
    });

    await addProfileExperience('complete-user', UserExperienceType.Work);
    await addProfileExperience('complete-user', UserExperienceType.Education);

    await expect(
      ensureProfileComplete(con, 'complete-user'),
    ).resolves.toBeUndefined();
  });

  it('should block post creation for incomplete profile', async () => {
    await con.getRepository(User).save({
      id: 'incomplete-user',
      image: 'https://daily.dev/incomplete-user.jpg',
    });

    await expect(ensureProfileComplete(con, 'incomplete-user')).rejects.toEqual(
      expect.objectContaining<Partial<ForbiddenError>>({
        message: 'Complete your profile to create posts',
      }),
    );
  });
});
