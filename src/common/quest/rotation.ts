import { DataSource } from 'typeorm';
import { FastifyBaseLogger } from 'fastify';
import { Quest, QuestType } from '../../entity/Quest';
import { QuestRotation } from '../../entity/QuestRotation';
import { getQuestWindow } from './window';

const REQUIRED_REGULAR_QUESTS: Record<QuestType, number> = {
  [QuestType.Daily]: 2,
  [QuestType.Weekly]: 1,
  [QuestType.Milestone]: 0,
  [QuestType.Intro]: 0,
};

const REQUIRED_PLUS_QUESTS = 1;

const compareQuestOrder = (left: Quest, right: Quest): number => {
  const createdAtDiff = left.createdAt.getTime() - right.createdAt.getTime();
  if (createdAtDiff !== 0) {
    return createdAtDiff;
  }

  return left.id.localeCompare(right.id);
};

const shuffleQuests = (quests: Quest[]): Quest[] => {
  const shuffled = [...quests];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }

  return shuffled;
};

const pickQuests = ({
  pool,
  count,
  selectedIds,
}: {
  pool: Quest[];
  count: number;
  selectedIds: Set<string>;
}): Quest[] => {
  if (count <= 0) {
    return [];
  }

  const picked: Quest[] = [];

  for (const quest of shuffleQuests(pool)) {
    if (selectedIds.has(quest.id)) {
      continue;
    }

    picked.push(quest);
    selectedIds.add(quest.id);

    if (picked.length === count) {
      break;
    }
  }

  return picked;
};

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
  const totalLimit = regularLimit + REQUIRED_PLUS_QUESTS;
  const { periodStart: previousPeriodStart } = getQuestWindow(
    type,
    new Date(periodStart.getTime() - 1),
  );

  const [allQuests, previousRotations] = await Promise.all([
    con.getRepository(Quest).find({
      where: { type, active: true },
      order: { createdAt: 'ASC', id: 'ASC' },
    }),
    con.getRepository(QuestRotation).find({
      where: {
        type,
        periodStart: previousPeriodStart,
      },
    }),
  ]);

  const previousQuestIds = new Set(
    previousRotations.map((rotation) => rotation.questId),
  );
  const freshQuests = allQuests.filter(
    (quest) => !previousQuestIds.has(quest.id),
  );
  let regularQuests: Quest[] = [];
  let plusQuests: Quest[] = [];

  if (freshQuests.length >= totalLimit) {
    const selectedFreshQuests = pickQuests({
      pool: freshQuests,
      count: totalLimit,
      selectedIds: new Set<string>(),
    }).sort(compareQuestOrder);

    regularQuests = selectedFreshQuests.slice(0, regularLimit);
    plusQuests = selectedFreshQuests.slice(regularLimit);
  } else {
    const selectedQuestIds = new Set<string>();

    regularQuests = pickQuests({
      pool: freshQuests,
      count: regularLimit,
      selectedIds: selectedQuestIds,
    });

    if (regularQuests.length < regularLimit) {
      regularQuests.push(
        ...pickQuests({
          pool: allQuests,
          count: regularLimit - regularQuests.length,
          selectedIds: selectedQuestIds,
        }),
      );
    }

    plusQuests = pickQuests({
      pool: freshQuests,
      count: REQUIRED_PLUS_QUESTS,
      selectedIds: selectedQuestIds,
    });

    if (plusQuests.length < REQUIRED_PLUS_QUESTS) {
      plusQuests.push(
        ...pickQuests({
          pool: allQuests,
          count: REQUIRED_PLUS_QUESTS - plusQuests.length,
          selectedIds: selectedQuestIds,
        }),
      );
    }

    regularQuests.sort(compareQuestOrder);
    plusQuests.sort(compareQuestOrder);
  }

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
