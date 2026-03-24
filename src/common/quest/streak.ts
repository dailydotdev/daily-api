import { QuestType } from '../../entity/Quest';
import { getQuestWindow } from './window';

const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;

const toUtcDayStart = (date: Date): number =>
  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

const toUtcDayTimestamp = (value: string | Date | null): number | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return toUtcDayStart(value);
  }

  const normalizedValue = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T00:00:00.000Z`
    : value;
  const parsedValue = new Date(normalizedValue);

  if (Number.isNaN(parsedValue.getTime())) {
    return null;
  }

  return toUtcDayStart(parsedValue);
};

const getUniqueCompletedDays = (
  completedDays: Array<string | Date | null>,
): number[] =>
  [
    ...new Set(
      completedDays
        .map((value) => toUtcDayTimestamp(value))
        .filter((value): value is number => value !== null),
    ),
  ].sort((left, right) => right - left);

export const calculateCurrentQuestStreak = ({
  completedDays,
  now = new Date(),
}: {
  completedDays: Array<string | Date | null>;
  now?: Date;
}): number => {
  const uniqueDays = getUniqueCompletedDays(completedDays);

  if (uniqueDays.length === 0) {
    return 0;
  }

  const today = getQuestWindow(QuestType.Daily, now).periodStart.getTime();
  const mostRecentCompletionDay = uniqueDays[0];

  if (
    mostRecentCompletionDay !== today &&
    mostRecentCompletionDay !== today - ONE_DAY_IN_MS
  ) {
    return 0;
  }

  let streak = 0;
  let expectedDay = mostRecentCompletionDay;

  for (const completedDay of uniqueDays) {
    if (completedDay !== expectedDay) {
      break;
    }

    streak += 1;
    expectedDay -= ONE_DAY_IN_MS;
  }

  return streak;
};

export const calculateLongestQuestStreak = ({
  completedDays,
}: {
  completedDays: Array<string | Date | null>;
}): number => {
  const uniqueDays = getUniqueCompletedDays(completedDays);

  if (uniqueDays.length === 0) {
    return 0;
  }

  let longestStreak = 1;
  let streak = 1;

  for (let index = 1; index < uniqueDays.length; index += 1) {
    if (uniqueDays[index] === uniqueDays[index - 1] - ONE_DAY_IN_MS) {
      streak += 1;
      longestStreak = Math.max(longestStreak, streak);
      continue;
    }

    streak = 1;
  }

  return longestStreak;
};
