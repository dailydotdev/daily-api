import { DayOfWeek, DEFAULT_WEEK_START } from './date';
import {
  Day,
  FREEZE_DAYS_IN_A_WEEK,
  STREAK_RECOVERY_MAX_GAP_DAYS,
} from './users';

interface DaysProps {
  day: number;
  firstDayOfWeek: Day;
  lastDayOfWeek: Day;
  lastView: Date;
}

const getNextDay = (day: number) => (day === 6 ? 0 : day + 1);
const getPreviousDay = (day: number) => (day === 0 ? 6 : day - 1);

export const getAllowedDays = ({
  day: dayToday,
  firstDayOfWeek,
  lastDayOfWeek,
  lastView,
}: DaysProps) => {
  const lastViewDay = lastView.getDay();
  const secondDayOfWeek = getNextDay(firstDayOfWeek);

  if (
    lastViewDay === lastDayOfWeek ||
    dayToday === lastDayOfWeek ||
    dayToday > secondDayOfWeek
  ) {
    return STREAK_RECOVERY_MAX_GAP_DAYS;
  }

  if (dayToday === firstDayOfWeek) {
    return STREAK_RECOVERY_MAX_GAP_DAYS + FREEZE_DAYS_IN_A_WEEK;
  }

  const dayOneWeekend = getPreviousDay(lastDayOfWeek);
  const validFreezeDays =
    dayOneWeekend === lastViewDay
      ? FREEZE_DAYS_IN_A_WEEK - 1
      : FREEZE_DAYS_IN_A_WEEK;

  return STREAK_RECOVERY_MAX_GAP_DAYS + validFreezeDays;
};

interface RestoreValidityParams {
  day: number;
  difference: number;
  lastView: Date;
  startOfWeek?: DayOfWeek;
}

export const checkRestoreValidity = ({
  day,
  difference,
  lastView,
  startOfWeek = DEFAULT_WEEK_START,
}: RestoreValidityParams) => {
  const firstDayOfWeek =
    startOfWeek === DayOfWeek.Monday ? Day.Monday : Day.Sunday;

  const lastDayOfWeek =
    startOfWeek === DayOfWeek.Monday ? Day.Sunday : Day.Saturday;

  const limit = getAllowedDays({
    day,
    lastDayOfWeek,
    firstDayOfWeek,
    lastView,
  });

  return difference === limit;
};
