import type { DataSource, EntityManager } from 'typeorm';
import { UserQuestProfile } from '../entity/user/UserQuestProfile';

export const awardXp = async ({
  con,
  userId,
  amount,
}: {
  con: DataSource | EntityManager;
  userId: string;
  amount: number;
}): Promise<void> => {
  if (amount <= 0) {
    return;
  }

  await con
    .createQueryBuilder()
    .insert()
    .into(UserQuestProfile)
    .values({
      userId,
      totalXp: 0,
    })
    .orIgnore()
    .execute();

  await con
    .createQueryBuilder()
    .update(UserQuestProfile)
    .set({
      totalXp: () => `"totalXp" + ${amount}`,
    })
    .where({
      userId,
    })
    .execute();
};
