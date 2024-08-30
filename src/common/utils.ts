import { startOfISOWeek, endOfISOWeek } from 'date-fns';
import { zonedTimeToUtc } from 'date-fns-tz';
import { snakeCase } from 'lodash';
import { isNullOrUndefined } from './object';

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

export /**
 * Remove duplicate values from an array of objects per unique key
 *
 * @template T
 * @template R
 * @param {T[]} array Array of objects
 * @param {(item: T) => string} uniqueKey Function to get the unique key from the item
 * @param {(item: T, index: number, uniqueKey: string) => R} [processItem] Optional function to process the item before adding it to the result array
 * @return {*}  {R[]}
 */
const uniqueifyObjectArray = <T, R = T>(
  array: T[],
  uniqueKey: (item: T) => string,
  processItem?: (item: T, index: number, uniqueKey: string) => R,
): R[] => {
  const uniqueMap = array.reduce((acc, item, index) => {
    const itemKey = uniqueKey(item);

    if (!acc.has(itemKey)) {
      const newItem =
        typeof processItem === 'function'
          ? processItem(item, index, itemKey)
          : item;

      acc.set(itemKey, newItem as unknown as R);
    }

    return acc;
  }, new Map<string, R>());

  return Array.from(uniqueMap.values());
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

export function debeziumTimeToDate(time: number): Date {
  return new Date(Math.floor(time / 1000));
}

export const safeJSONParse = <T>(json: string): T | undefined => {
  try {
    return JSON.parse(json);
  } catch {
    return undefined;
  }
};

export function isNumber(value: string | number): boolean {
  if (isNullOrUndefined(value)) {
    return false;
  }

  if (!['string', 'number'].includes(typeof value)) {
    return false;
  }

  if (typeof value === 'string' && value.trim().length === 0) {
    return false;
  }

  return !isNaN(Number(value.toString()));
}

const ignoredWorkEmailDomains =
  process.env.IGNORED_WORK_EMAIL_DOMAINS?.split(',')
    .filter(Boolean)
    .map((domain) => domain.toLowerCase()) || [];

export const validateWorkEmailDomain = (domain: string): boolean => {
  const lowerCaseDomain = domain.toLowerCase();

  return ignoredWorkEmailDomains.some((ignoredDomain) =>
    lowerCaseDomain.includes(ignoredDomain),
  );
};
