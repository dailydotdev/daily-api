import { utcToZonedTime } from 'date-fns-tz';

export const getTodayTz = (timeZone: string) => {
  const now = new Date();
  return utcToZonedTime(now, timeZone);
};
