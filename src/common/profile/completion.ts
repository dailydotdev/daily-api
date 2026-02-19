import { ForbiddenError } from 'apollo-server-errors';
import { DataSource, EntityManager } from 'typeorm';
import { User } from '../../entity';
import { UserExperience } from '../../entity/user/experiences/UserExperience';
import { UserExperienceType } from '../../entity/user/experiences/types';
import { features, getUserGrowthBookInstance } from '../../growthbook';
import { queryReadReplica } from '../queryReadReplica';

export type ProfileCompletion = {
  percentage: number;
  hasProfileImage: boolean;
  hasHeadline: boolean;
  hasExperienceLevel: boolean;
  hasWork: boolean;
  hasEducation: boolean;
};

export type ProfileExperienceFlags = {
  hasWork: boolean;
  hasEducation: boolean;
};

const getProfileExperienceFlagsFromManager = async (
  manager: EntityManager,
  userId: string,
): Promise<ProfileExperienceFlags> => {
  const result = await manager
    .createQueryBuilder(UserExperience, 'ue')
    .select(`MAX(CASE WHEN ue.type = :workType THEN 1 ELSE 0 END)`, 'hasWork')
    .addSelect(
      `MAX(CASE WHEN ue.type = :educationType THEN 1 ELSE 0 END)`,
      'hasEducation',
    )
    .where('ue.userId = :userId', { userId })
    .andWhere('ue.type IN (:...types)', {
      types: [UserExperienceType.Work, UserExperienceType.Education],
    })
    .setParameters({
      workType: UserExperienceType.Work,
      educationType: UserExperienceType.Education,
    })
    .getRawOne();

  return {
    hasWork: result?.hasWork == 1,
    hasEducation: result?.hasEducation == 1,
  };
};

export const getProfileExperienceFlags = async (
  con: DataSource | EntityManager,
  userId: string,
): Promise<ProfileExperienceFlags> => {
  if (con instanceof DataSource) {
    return queryReadReplica(con, ({ queryRunner }) =>
      getProfileExperienceFlagsFromManager(queryRunner.manager, userId),
    );
  }

  return getProfileExperienceFlagsFromManager(con, userId);
};

export const calculateProfileCompletion = (
  user: Pick<User, 'image' | 'bio' | 'experienceLevel'> | null,
  experienceFlags: ProfileExperienceFlags | null,
): ProfileCompletion | null => {
  if (!user || !experienceFlags) {
    return null;
  }

  const hasProfileImage = !!user.image && user.image !== '';
  const hasHeadline = !!user.bio && user.bio.trim() !== '';
  const hasExperienceLevel = !!user.experienceLevel;
  const { hasWork, hasEducation } = experienceFlags;

  const completedItems = [
    hasProfileImage,
    hasHeadline,
    hasExperienceLevel,
    hasWork,
    hasEducation,
  ].filter(Boolean).length;

  const percentage = Math.round((completedItems / 5) * 100);
  return {
    percentage,
    hasProfileImage,
    hasHeadline,
    hasExperienceLevel,
    hasWork,
    hasEducation,
  };
};

const getProfileCompletion = async (
  con: DataSource | EntityManager,
  userId: string,
): Promise<ProfileCompletion | null> => {
  const queryByManager = async (
    manager: EntityManager,
  ): Promise<ProfileCompletion | null> => {
    const [user, experienceFlags] = await Promise.all([
      manager.getRepository(User).findOne({
        where: { id: userId },
        select: ['id', 'image', 'bio', 'experienceLevel'],
      }),
      getProfileExperienceFlagsFromManager(manager, userId),
    ]);

    return calculateProfileCompletion(user, experienceFlags);
  };

  if (con instanceof DataSource) {
    return queryReadReplica(con, ({ queryRunner }) =>
      queryByManager(queryRunner.manager),
    );
  }

  return queryByManager(con);
};

export const ensureProfileComplete = async (
  con: DataSource | EntityManager,
  userId: string,
  requiredPercentage = 100,
): Promise<void> => {
  const completion = await getProfileCompletion(con, userId);

  if (!completion || completion.percentage < requiredPercentage) {
    throw new ForbiddenError('Complete your profile to create posts');
  }
};

export const ensureProfileCompleteIfEnabled = async (
  con: DataSource | EntityManager,
  userId: string,
): Promise<void> => {
  const gb = getUserGrowthBookInstance(userId);
  const gateEnabled = gb.getFeatureValue(
    features.profileCompletionPostGate.id,
    features.profileCompletionPostGate.defaultValue ?? false,
  );

  if (!gateEnabled) {
    return;
  }

  await ensureProfileComplete(con, userId);
};
