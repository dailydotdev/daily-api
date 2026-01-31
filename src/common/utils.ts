import { startOfISOWeek, endOfISOWeek } from 'date-fns';
import { zonedTimeToUtc } from 'date-fns-tz';
import { snakeCase } from 'lodash';
import { isNullOrUndefined } from './object';
import { remoteConfig } from '../remoteConfig';
import { ChangeObject } from '../types';
import { logger } from '../logger';
import slugify from 'slugify';

const REMOVE_SPECIAL_CHARACTERS_REGEX = /[^a-zA-Z0-9-_#.]/g;

export const DELETED_BY_WORKER = 'worker';

export const playwrightUser = {
  id: '8bf2UpTsHFnczzOlk0mtg',
};

export const ghostUser = {
  id: '404',
  username: 'ghost',
  name: 'Deleted user',
  image:
    'https://media.daily.dev/image/upload/s--hNIUzLiO--/f_auto/v1705327420/public/ghost_vlftth',
};

export const deletedPost = {
  id: '404',
};

export const systemUser = {
  id: 'system',
  username: 'system',
  name: 'System',
};

export const systemUserIds = [systemUser.id, ghostUser.id, playwrightUser.id];

export const demoCompany = {
  id: 'e8c7a930-ca69-4cba-b26c-b6c810d6ab7d',
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

export const updateNotificationFlags = <
  Entity extends {
    notificationFlags: object;
  },
>(
  update: Partial<Entity['notificationFlags']>,
): (() => string) => {
  return () => `notificationFlags || '${JSON.stringify(update)}'`;
};

export const updateSubscriptionFlags = <
  Entity extends {
    subscriptionFlags: object;
  },
>(
  update: Partial<Entity['subscriptionFlags']>,
): (() => string) => {
  return () => `subscriptionFlags || '${JSON.stringify(update)}'`;
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
 * Remove duplicate values from an array of objects per unique key
 *
 * @template T
 * @template R
 * @param {T[]} array Array of objects
 * @param {(item: T) => string} uniqueKey Function to get the unique key from the item
 * @param {(item: T, index: number, uniqueKey: string) => R} [processItem] Optional function to process the item before adding it to the result array
 * @return {*}  {R[]}
 */
export const uniqueifyObjectArray = <T, R = T>(
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

export const isTest = process.env.NODE_ENV === 'test';

export const parseDate = (
  date: string | Date | undefined,
): Date | undefined => {
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

export const toChangeObject = <T>(entity: T): ChangeObject<T> =>
  JSON.parse(Buffer.from(JSON.stringify(entity)).toString('utf-8').trim());

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

export const getDateBaseFromType = (value: number | string | Date) => {
  if (typeof value === 'number') {
    return debeziumTimeToDate(value);
  }

  return new Date(value);
};

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

export const VALID_FOLDER_EMOJIS = [
  `🐹`,
  '🐍',
  '☕️',
  '🔥',
  '📦',
  '⚙️',
  '🐙',
  '🐳',
  '💡',
  '📜',
  '🚀',
];
export const isOneValidEmoji = (text: string): boolean => {
  return VALID_FOLDER_EMOJIS.includes(text);
};

export const validateWorkEmailDomain = (domain: string): boolean => {
  const lowerCaseDomain = domain.toLowerCase();

  return !!remoteConfig.vars.ignoredWorkEmailDomains?.some(
    (ignoredDomain) => lowerCaseDomain === ignoredDomain,
  );
};

export const unwrapArray = <T>(
  arrayOrValue: T[] | T | undefined,
): T | undefined => {
  if (Array.isArray(arrayOrValue)) {
    return arrayOrValue[0];
  }

  return arrayOrValue;
};

export const parseBigInt = (value: bigint): number => {
  try {
    return Number(value);
  } catch (originalError) {
    const error = originalError as Error;

    logger.error(
      { err: originalError, value: value?.toString() },
      'failed parsing bigint',
    );

    throw error;
  }
};

export const isSpecialUser = ({
  userId,
}: {
  userId?: string | null;
}): boolean => {
  return !!userId && [ghostUser.id, systemUser.id].includes(userId);
};

export const getCurrencySymbol = ({
  locale,
  currency,
}: {
  locale: string;
  currency: string;
}) => {
  return (0)
    .toLocaleString(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
    .replace(/\d/g, '')
    .trim();
};

export const concatTextToNewline = (...args: Array<string | undefined>) =>
  args.filter(Boolean).join(`\n`);

export const getBufferFromStream = async (
  stream: NodeJS.ReadableStream,
): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', (err) => reject(err));
  });
};

export const textToSlug = (text: string): string =>
  slugify(text, {
    lower: true,
    strict: true,
    trim: true,
    locale: 'en',
    replacement: '-',
  }).substring(0, 100);

export const truncateText = (
  text: string | null | undefined,
  maxLength = 500,
): string | null =>
  text
    ? text.length > maxLength
      ? `${text.slice(0, maxLength - 3)}...`
      : text
    : null;

export const updateRecruiterSubscriptionFlags = <
  Entity extends {
    recruiterSubscriptionFlags: object;
  },
>(
  update: Partial<Entity['recruiterSubscriptionFlags']>,
): (() => string) => {
  return () => `recruiterSubscriptionFlags || '${JSON.stringify(update)}'`;
};
