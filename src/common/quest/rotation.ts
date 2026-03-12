import { DataSource, In, Not } from 'typeorm';
import { FastifyBaseLogger } from 'fastify';
import { Quest, QuestType } from '../../entity/Quest';
import { QuestRotation } from '../../entity/QuestRotation';
import { getQuestWindow } from './window';

const REQUIRED_REGULAR_QUESTS: Record<QuestType, number> = {
  [QuestType.Daily]: 2,
  [QuestType.Weekly]: 1,
};

const REQUIRED_PLUS_QUESTS = 1;

export interface RotateQuestPeriodResult {
  type: QuestType;
  periodStart: Date;
  periodEnd: Date;
  attempted: number;
  created: number;
}

export const rotateQuestPeriod = async ({
  con,
  logger,
  type,
  now = new Date(),
}: {
  con: DataSource;
  logger: FastifyBaseLogger;
  type: QuestType;
  now?: Date;
}): Promise<RotateQuestPeriodResult> => {
  const { periodStart, periodEnd } = getQuestWindow(type, now);
  const regularLimit = REQUIRED_REGULAR_QUESTS[type];

  const regularQuests = await con.getRepository(Quest).find({
    where: { type, plusOnly: false, active: true },
    order: { createdAt: 'ASC', id: 'ASC' },
    take: regularLimit,
  });

  const plusQuests = await con.getRepository(Quest).find({
    // Plus is an extra slot from the normal quest pool, not a separate quest catalog.
    where: {
      type,
      plusOnly: false,
      active: true,
      ...(regularQuests.length
        ? { id: Not(In(regularQuests.map(({ id }) => id))) }
        : {}),
    },
    order: { createdAt: 'ASC', id: 'ASC' },
    take: REQUIRED_PLUS_QUESTS,
  });

  if (regularQuests.length < regularLimit) {
    logger.warn(
      { type, expected: regularLimit, found: regularQuests.length },
      'Insufficient regular quests available for rotation',
    );
  }

  if (plusQuests.length < REQUIRED_PLUS_QUESTS) {
    logger.warn(
      { type, expected: REQUIRED_PLUS_QUESTS, found: plusQuests.length },
      'Insufficient extra quests available for plus rotation',
    );
  }

  const rotationRows: Pick<
    QuestRotation,
    'questId' | 'type' | 'plusOnly' | 'slot' | 'periodStart' | 'periodEnd'
  >[] = [
    ...regularQuests.map((quest, index) => ({
      questId: quest.id,
      type,
      plusOnly: false,
      slot: index + 1,
      periodStart,
      periodEnd,
    })),
    ...plusQuests.map((quest, index) => ({
      questId: quest.id,
      type,
      plusOnly: true,
      slot: index + 1,
      periodStart,
      periodEnd,
    })),
  ];

  if (!rotationRows.length) {
    return {
      type,
      periodStart,
      periodEnd,
      attempted: 0,
      created: 0,
    };
  }

  const result = await con
    .createQueryBuilder()
    .insert()
    .into(QuestRotation)
    .values(rotationRows)
    .orIgnore()
    .execute();

  const created = Array.isArray(result.identifiers)
    ? result.identifiers.length
    : 0;

  return {
    type,
    periodStart,
    periodEnd,
    attempted: rotationRows.length,
    created,
  };
};
