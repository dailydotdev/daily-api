import type { Cron } from './cron';

import { logger } from '../logger';
import { readFile } from 'fs/promises';
import path from 'path';
import { UserStats, UserTopReader } from '../entity';
import { endOfMonth, subMonths } from 'date-fns';
import { SQL_QUERIES_PATH } from '../config';

type TopReaderQueryResult = {
  keyword: string;
  keywordRank: number;
  userId: string;
  userViewCount: number;
  rank: number;
};

const LIMIT_PER_KEYWORD = 10;
const MINIMUM_UNIQUE_VIEWERS = 500;
const TOP_READERS_TO_SELECT = 100;

export const calculateTopReaders: Cron = {
  name: 'calculate-top-readers',
  handler: async (con) => {
    logger.info('calculateTopReaders');
    // Set issuedAt to be the last day of the previous month
    const issuedAt = new Date(
      endOfMonth(subMonths(new Date(), 1)).setHours(0, 0, 0, 0),
    );

    const topReaders: Record<string, string[]> = {};
    const userIds = new Map<string, boolean>();
    const keywords: Record<string, Omit<TopReaderQueryResult, 'keyword'>[]> =
      {};

    try {
      const sql = await readFile(
        path.join(SQL_QUERIES_PATH, 'calculateTopReaders.sql'),
        'utf8',
      );

      const result = await con.query<TopReaderQueryResult[]>(sql, [
        MINIMUM_UNIQUE_VIEWERS,
        TOP_READERS_TO_SELECT,
      ]);
      if (!result.length) {
        logger.error('calculateTopReaders: no results');
        return;
      }
      logger.info(
        { count: result.length },
        'calculateTopReaders: Fetched results',
      );

      await con.transaction(async (manager) => {
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
          logger.info({ keyword }, 'calculateTopReaders: Processing keyword');
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
              logger.debug(
                { keyword, counter },
                'calculateTopReaders: limit reached',
              );
              break; // Break out of the loop and continue to the next keyword
            }

            // We need to ensure that we don't assign the same userId to multiple keywords
            if (userIds.has(userId)) {
              logger.debug(
                { userId, keyword },
                'calculateTopReaders: duplicate userId',
              );
              continue; // Continue to the next user
            } else {
              userIds.set(userId, true);
            }

            topReaders[keyword].push(userId);
            counter++;

            await manager.getRepository(UserTopReader).upsert(
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
          }

          logger.info(
            {
              keyword,
              topReaders: topReaders[keyword],
              count: topReaders[keyword].length,
            },
            'calculateTopReaders: Inserted rows',
          );
        }

        logger.info('calculateTopReaders: Refreshing materialized view');
        await manager.query(
          `REFRESH MATERIALIZED VIEW ${con.getRepository(UserStats).metadata.tableName}`,
        );
      });

      logger.info(
        'calculateTopReaders: All done. So long and thanks for all the fish!',
      );
    } catch (error) {
      logger.error({ error }, 'Error during calculation of top readers');
    }
  },
};
