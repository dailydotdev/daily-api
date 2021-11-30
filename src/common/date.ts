import { isEqual } from 'date-fns';

export const isDateOnlyEqual = (left: Date, right: Date): boolean => {
  const formattedLeft = new Date(
    left.getFullYear(),
    left.getMonth(),
    left.getDate(),
  );
  const formattedRight = new Date(
    right.getFullYear(),
    right.getMonth(),
    right.getDate(),
  );

  return isEqual(formattedLeft, formattedRight);
};
