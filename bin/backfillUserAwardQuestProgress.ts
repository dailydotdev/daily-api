import '../src/config';
import { parseArgs } from 'node:util';
import { In } from 'typeorm';
import createOrGetConnection from '../src/db';
import { Quest, QuestEventType, QuestType } from '../src/entity/Quest';
import { QuestRotation } from '../src/entity/QuestRotation';
import { UserQuest, UserQuestStatus } from '../src/entity/user/UserQuest';
import { UserTransactionStatus } from '../src/entity/user/UserTransaction';
import { ProductType } from '../src/entity/Product';

type AwardCountRow = {
  userId: string;
  count: string;
};

const TERMINAL_STATUSES = [UserQuestStatus.Claimed];

const start = async (): Promise<void> => {
  const { values } = parseArgs({
    options: { apply: { type: 'boolean', default: false } },
  });
  const apply = values.apply === true;

  const con = await createOrGetConnection();
  const now = new Date();

  try {
    const rotations = await con
      .getRepository(QuestRotation)
      .createQueryBuilder('qr')
      .innerJoin(
        Quest,
        'q',
        'q.id = qr."questId" AND q.active = true AND q."eventType" = :eventType',
        { eventType: QuestEventType.AwardGiven },
      )
      .where('qr.type = :type', { type: QuestType.Weekly })
      .andWhere('qr."periodStart" <= :now', { now })
      .andWhere('qr."periodEnd" > :now', { now })
      .getMany();

    if (!rotations.length) {
      console.log('No active weekly AwardGiven rotations found.');
      return;
    }

    const quests = await con.getRepository(Quest).find({
      where: { id: In(rotations.map((r) => r.questId)) },
    });
    const questById = new Map(quests.map((q) => [q.id, q]));

    let totalUsers = 0;
    let totalUpdated = 0;
    let totalCompleted = 0;

    for (const rotation of rotations) {
      const quest = questById.get(rotation.questId);
      if (!quest) {
        continue;
      }
      const targetCount = Math.max(
        1,
        Math.floor(quest.criteria?.targetCount ?? 1),
      );

      const rows: AwardCountRow[] = await con
        .createQueryBuilder()
        .select('ut."senderId"', 'userId')
        .addSelect('COUNT(*)', 'count')
        .from('user_transaction', 'ut')
        .innerJoin('product', 'p', 'p.id = ut."productId"')
        .where('ut.status = :success', {
          success: UserTransactionStatus.Success,
        })
        .andWhere('ut."referenceType" IS NULL')
        .andWhere('ut."senderId" IS NOT NULL')
        .andWhere('ut."senderId" <> ut."receiverId"')
        .andWhere('p.type = :productType', { productType: ProductType.Award })
        .andWhere('ut."createdAt" >= :start', { start: rotation.periodStart })
        .andWhere('ut."createdAt" < :end', { end: rotation.periodEnd })
        .groupBy('ut."senderId"')
        .getRawMany();

      console.log(
        `Rotation ${rotation.id} (quest="${quest.name}", target=${targetCount}, period=${rotation.periodStart.toISOString()}..${rotation.periodEnd.toISOString()}): ${rows.length} users to backfill`,
      );

      let rotationUpdated = 0;
      let rotationCompleted = 0;

      for (const row of rows) {
        const missed = Math.min(Number(row.count), targetCount);
        if (missed <= 0) {
          continue;
        }

        totalUsers++;

        if (!apply) {
          console.log(
            `  [dry-run] user=${row.userId} +${missed} (from ${row.count} user awards)`,
          );
          continue;
        }

        const updateResult = await con
          .createQueryBuilder()
          .update(UserQuest)
          .set({
            progress: () =>
              'least(:targetCount, greatest(0, "progress") + :missed)',
            status: () =>
              `CASE WHEN least(:targetCount, greatest(0, "progress") + :missed) >= :targetCount THEN :completed ELSE "status" END`,
            completedAt: () =>
              `CASE WHEN least(:targetCount, greatest(0, "progress") + :missed) >= :targetCount THEN coalesce("completedAt", :now) ELSE "completedAt" END`,
          })
          .where('"rotationId" = :rotationId', { rotationId: rotation.id })
          .andWhere('"userId" = :userId', { userId: row.userId })
          .andWhere('"status" NOT IN (:...terminal)', {
            terminal: TERMINAL_STATUSES,
          })
          .returning(['status'])
          .setParameters({
            targetCount,
            missed,
            completed: UserQuestStatus.Completed,
            now,
          })
          .execute();

        if ((updateResult.affected ?? 0) > 0) {
          rotationUpdated++;
          const status = updateResult.raw?.[0]?.status;
          if (status === UserQuestStatus.Completed) {
            rotationCompleted++;
          }
          continue;
        }

        const progress = Math.min(targetCount, missed);
        const status =
          progress >= targetCount
            ? UserQuestStatus.Completed
            : UserQuestStatus.InProgress;

        const insertResult = await con
          .createQueryBuilder()
          .insert()
          .into(UserQuest)
          .values({
            rotationId: rotation.id,
            userId: row.userId,
            progress,
            status,
            completedAt: status === UserQuestStatus.Completed ? now : null,
            claimedAt: null,
          })
          .orIgnore()
          .execute();

        if (insertResult.identifiers.length > 0) {
          rotationUpdated++;
          if (status === UserQuestStatus.Completed) {
            rotationCompleted++;
          }
        }
      }

      console.log(
        `  → updated=${rotationUpdated}, newlyCompleted=${rotationCompleted}`,
      );
      totalUpdated += rotationUpdated;
      totalCompleted += rotationCompleted;
    }

    console.log(
      `Done. mode=${apply ? 'APPLY' : 'DRY-RUN'} users=${totalUsers} updated=${totalUpdated} newlyCompleted=${totalCompleted}`,
    );
  } finally {
    await con.destroy();
  }
};

start()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
