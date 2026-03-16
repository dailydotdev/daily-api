import { QuestType } from '../../entity/Quest';

const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;
const ONE_WEEK_IN_MS = 7 * ONE_DAY_IN_MS;

const getUtcDayStart = (date: Date): Date =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

export const getQuestWindow = (
  type: QuestType,
  now: Date = new Date(),
): { periodStart: Date; periodEnd: Date } => {
  const dayStart = getUtcDayStart(now);

  if (type === QuestType.Daily) {
    return {
      periodStart: dayStart,
      periodEnd: new Date(dayStart.getTime() + ONE_DAY_IN_MS),
    };
  }

  const dayOfWeek = dayStart.getUTCDay(); // 0 = Sunday, 1 = Monday
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const weekStart = new Date(
    dayStart.getTime() - daysSinceMonday * ONE_DAY_IN_MS,
  );

  return {
    periodStart: weekStart,
    periodEnd: new Date(weekStart.getTime() + ONE_WEEK_IN_MS),
  };
};
