export const getTodayTz = (timeZone: string) => {
  const now = new Date();
  const timeZonedToday = now.toLocaleDateString('en', { timeZone });
  return new Date(timeZonedToday);
};
