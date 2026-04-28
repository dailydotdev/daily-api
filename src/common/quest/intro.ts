import type { DataSource, EntityManager } from 'typeorm';
import { LessThanOrEqual, MoreThan } from 'typeorm';
import { QuestType } from '../../entity/Quest';
import { QuestRotation } from '../../entity/QuestRotation';
import { UserQuest, UserQuestStatus } from '../../entity/user/UserQuest';

export const assignIntroQuestsToUser = async ({
  con,
  userId,
  now = new Date(),
}: {
  con: DataSource | EntityManager;
  userId: string;
  now?: Date;
}): Promise<void> => {
  const rotations = await con.getRepository(QuestRotation).find({
    where: {
      type: QuestType.Intro,
      periodStart: LessThanOrEqual(now),
      periodEnd: MoreThan(now),
    },
    select: ['id'],
  });

  if (!rotations.length) {
    return;
  }

  await con
    .createQueryBuilder()
    .insert()
    .into(UserQuest)
    .values(
      rotations.map((rotation) => ({
        rotationId: rotation.id,
        userId,
        progress: 0,
        status: UserQuestStatus.InProgress,
        completedAt: null,
        claimedAt: null,
      })),
    )
    .orIgnore()
    .execute();
};
