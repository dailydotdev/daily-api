import { addYears } from 'date-fns';

const NEXT_YEAR = 1;

export const changeYearToNextYear = (date: Date) => {
  const current = new Date();
  const difference = current.getFullYear() - date.getFullYear() + NEXT_YEAR;

  return addYears(date, difference);
};
