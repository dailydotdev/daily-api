import { DataSource, EntityManager } from 'typeorm';
import { User } from '../../entity';
import { UserExperience } from '../../entity/user/experiences/UserExperience';
import { UserExperienceType } from '../../entity/user/experiences/types';
import { queryReadReplica } from '../queryReadReplica';
import { checkQuestProgress } from '../quest/progress';
import { QuestEventType } from '../../entity/Quest';
import { logger } from '../../logger';

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

export const checkProfileCompleteQuestProgress = async ({
  con,
  userId,
}: {
  con: DataSource | EntityManager;
  userId: string;
}): Promise<void> => {
  try {
    const [user, experienceFlags] = await Promise.all([
      con.getRepository(User).findOne({
        where: { id: userId },
        select: ['image', 'bio', 'experienceLevel'],
      }),
      getProfileExperienceFlagsFromManager(
        con instanceof DataSource ? con.manager : con,
        userId,
      ),
    ]);

    const completion = calculateProfileCompletion(user, experienceFlags);
    if (completion?.percentage !== 100) {
      return;
    }

    await checkQuestProgress({
      con,
      logger,
      userId,
      eventType: QuestEventType.ProfileComplete,
    });
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err), userId },
      'Failed to track profile complete quest progress',
    );
  }
};
