import type { Cron } from './cron';

import { logger } from '../logger';
import { readFile } from 'fs/promises';
import path from 'path';
import { UserTopReader } from '../entity';
import { endOfMonth, subMonths } from 'date-fns';

// import typeCastResult from './2024-october.json';

type TopReaderQueryResult = {
  keyword: string;
  keywordRank: number;
  userId: string;
  userViewCount: number;
  rank: number;
};

const LIMIT_PER_KEYWORD = 10;
// const result = typeCastResult as unknown as TopReaderQueryResult[];

export const calculateTopReaders: Cron = {
  name: 'calculate-top-readers',
  handler: async (con) => {
    logger.info('calculateTopReaders');
    // Set issuedAt to be the last day of the previous month
    const issuedAt = endOfMonth(subMonths(new Date(), 1));

    const topReaders: Record<string, string[]> = {};
    const userIds: string[] = [];
    const keywords: Record<string, Omit<TopReaderQueryResult, 'keyword'>[]> =
      {};

    try {
      const sql = await readFile(
        path.join(__dirname, 'calculateTopReaders.sql'),
        'utf8',
      );

      const result = await con.query<TopReaderQueryResult[]>(sql);
      if (!result.length) {
        logger.error('calculateTopReaders: no results');
        return;
      }

      // We need to separate the users into their respective keywords
      result.forEach((row) => {
        const { keyword } = row;
        if (!keywords[keyword]) {
          keywords[keyword] = [];
        }
        keywords[keyword].push(row);
      });

      // Iterate over the keywords
      for (const keyword of Object.keys(keywords)) {
        const topReadersForKeyword = keywords[keyword];

        if (!topReaders[keyword]) {
          topReaders[keyword] = [];
        }

        // We reset it to 1 every time we loop through the keywords
        let counter = 1;

        // Iterate over the top readers for the keyword
        for (const topReader of topReadersForKeyword) {
          const { userId } = topReader;

          // We need to exit the loop once we've reached the limit of top readers per keyword
          if (counter > LIMIT_PER_KEYWORD) {
            logger.debug({ keyword, counter }, 'limit reached');
            break; // Break out of the loop and continue to the next keyword
          }

          // We need to ensure that we don't assign the same userId to multiple keywords
          if (userIds.includes(userId)) {
            logger.debug({ userId, keyword }, 'duplicate userId');
            continue; // Continue to the next user
          } else {
            userIds.push(userId);
          }

          topReaders[keyword].push(userId);
          counter++;

          await con.getRepository(UserTopReader).upsert(
            {
              userId,
              keywordValue: keyword,
              issuedAt: issuedAt,
            },
            {
              conflictPaths: ['userId', 'issuedAt', 'keywordValue'],
              skipUpdateIfNoValuesChanged: true,
            },
          );

          continue; // Continue to the next user
        }

        logger.info(
          {
            keyword,
            topReaders: topReaders[keyword],
            count: topReaders[keyword].length,
          },
          'Inserted rows',
        );
      }
    } catch (error) {
      logger.error({ error }, 'Error during calculation of top readers');
    }
  },
};
