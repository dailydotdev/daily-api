export enum DayOfWeek {
  Sunday = 0,
  Monday = 1,
  Tuesday = 2,
  Wednesday = 3,
  Thursday = 4,
  Friday = 5,
  Saturday = 6,
}

export const DEFAULT_TIMEZONE = 'Etc/UTC';
export const DEFAULT_WEEK_START = DayOfWeek.Monday;

export const VALID_WEEK_STARTS = [DayOfWeek.Monday, DayOfWeek.Sunday];

export const isWeekend = (
  date: Date | string | number,
  startOfWeek: DayOfWeek = DEFAULT_WEEK_START,
): boolean => {
  const day = new Date(date).getDay();
  switch (startOfWeek) {
    case DayOfWeek.Sunday:
      return day === DayOfWeek.Friday || day === DayOfWeek.Saturday;
    case DayOfWeek.Monday:
    default:
      return day === DayOfWeek.Saturday || day === DayOfWeek.Sunday;
  }
};

export const getSecondsTimestamp = (ms: number | Date): number => {
  const msValue = ms instanceof Date ? ms.getTime() : ms;

  return Math.floor(msValue / 1000);
};
