import { startOfISOWeek, endOfISOWeek } from 'date-fns';
import { zonedTimeToUtc } from 'date-fns-tz';
import { snakeCase } from 'lodash';

const REMOVE_SPECIAL_CHARACTERS_REGEX = /[^a-zA-Z0-9-_#.]/g;

export const ghostUser = {
  id: '404',
  username: 'ghost',
  name: 'Deleted user',
};

interface GetTimezonedIsoWeekProps {
  date: Date;
  timezone: string;
}
export const getTimezonedStartOfISOWeek = ({
  date,
  timezone,
}: GetTimezonedIsoWeekProps): Date => {
  return zonedTimeToUtc(startOfISOWeek(date), timezone);
};

export const getTimezonedEndOfISOWeek = ({
  date,
  timezone,
}: GetTimezonedIsoWeekProps): Date => {
  return zonedTimeToUtc(endOfISOWeek(date), timezone);
};

export const updateFlagsStatement = <Entity extends { flags: object }>(
  update: Partial<Entity['flags']>,
): (() => string) => {
  return () => `flags || '${JSON.stringify(update)}'`;
};

/**
 * Remove special characters from a string
 * Only allows alphanumeric, -, _, # and . characters
 *
 * @param text
 */
export const removeSpecialCharacters = (text: string): string => {
  return text.replace(REMOVE_SPECIAL_CHARACTERS_REGEX, '');
};

/**
 * Remove duplicate values from an array
 *
 * @param array
 */
export const uniqueifyArray = <T>(array: T[]): T[] => {
  return [...new Set(array)];
};

/**
 * Remove empty values from an array
 *
 * @param array
 */
export const removeEmptyValues = <T>(array: T[]): T[] => array.filter(Boolean);

/**
 * Check if the current environment is production
 *
 * @returns boolean
 */
export const isProd = process.env.NODE_ENV === 'production';

export const parseDate = (date: string | Date): Date | undefined => {
  if (!date) {
    return undefined;
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return undefined;
  }

  if (parsedDate.getTime() < 0) {
    return undefined;
  }

  return parsedDate;
};

export const toGQLEnum = (value: Record<string, string>, name: string) => {
  return `enum ${name} { ${Object.values(value).join(' ')} }`;
};

export function camelCaseToSnakeCase(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const snakeObj: Record<string, unknown> = {};
  for (const key in obj) {
    snakeObj[snakeCase(key)] = obj[key];
  }
  return snakeObj;
}
