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

export const transformDate = (value?: string | Date): Date | undefined =>
  value ? new Date(value) : undefined;

export const oneMinute = 60;
export const oneHour = 3600;
export const oneDay = 86400;
const oneWeek = 7 * oneDay;
export const oneYear = oneDay * 365;

export const relativeLongDateFormat = ({
  value,
  now = new Date(),
}: {
  value: Date | number | string;
  now: Date;
}): string => {
  const date = new Date(value);

  // Calculate time delta in seconds.
  const dt = (now.getTime() - date.getTime()) / 1000;

  if (dt <= oneMinute) {
    return 'now';
  }

  if (dt <= oneHour) {
    const numMinutes = Math.round(dt / oneMinute);
    return `${numMinutes} ${numMinutes === 1 ? 'minute' : 'minutes'}`;
  }

  if (dt <= oneDay) {
    const numHours = Math.round(dt / oneHour);
    return `${numHours} ${numHours === 1 ? 'hour' : 'hours'}`;
  }

  if (dt <= oneWeek) {
    const numDays = Math.round(dt / oneDay);
    return `${numDays} ${numDays === 1 ? 'day' : 'days'}`;
  }

  if (dt <= oneYear) {
    const numWeeks = Math.round(dt / oneWeek);
    return `${numWeeks} ${numWeeks === 1 ? 'week' : 'weeks'}`;
  }

  const numYears = Math.round(dt / oneYear);
  return `${numYears} ${numYears === 1 ? 'year' : 'years'}`;
};

export const relativeShortDateFormat = ({
  value,
  now = new Date(),
}: {
  value: Date | number | string;
  now: Date;
}): string => {
  const date = new Date(value);

  // Calculate time delta in seconds.
  const dt = (now.getTime() - date.getTime()) / 1000;

  if (dt <= oneMinute) {
    return 'now';
  }

  if (dt <= oneHour) {
    const numMinutes = Math.round(dt / oneMinute);
    return `${numMinutes}m`;
  }

  if (dt <= oneDay) {
    const numHours = Math.round(dt / oneHour);
    return `${numHours}h`;
  }

  if (dt <= oneWeek) {
    const numDays = Math.round(dt / oneDay);
    return `${numDays}d`;
  }

  if (dt <= oneYear) {
    const numWeeks = Math.round(dt / oneWeek);
    return `${numWeeks}w`;
  }

  const numYears = Math.round(dt / oneYear);
  return `${numYears}y`;
};

export const liveTimerDateFormat = ({
  value,
  now = new Date(),
  short = false,
}: {
  value: Date | number | string;
  now?: Date;
  short?: boolean;
}) => {
  const date = new Date(value);

  const dt = (now.getTime() - date.getTime()) / 1000;

  if (dt <= oneMinute) {
    const numSeconds = Math.round(dt) || 1; // always show at least 1s to show timer running

    return `${numSeconds}s`;
  }

  return short
    ? relativeShortDateFormat({ value, now })
    : relativeLongDateFormat({ value, now });
};
