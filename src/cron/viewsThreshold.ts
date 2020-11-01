import { Cron } from './cron';
import { notifyPostReachedViewsThreshold } from '../common';

type UpdateResult = { id: string }[];

const cron: Cron = {
  name: 'viewsThreshold',
  handler: async (con) => {
    const thresholds = [250, 500].reverse();

    const updatedIds = await con.transaction(
      async (entityManager): Promise<UpdateResult[]> =>
        Promise.all(
          thresholds.map(
            async (thresh, reversedIndex): Promise<UpdateResult> => {
              const index = thresholds.length - reversedIndex - 1;
              const [res]: UpdateResult[] = await entityManager.query(
                `UPDATE "post"
             SET "viewsThreshold" = $1
             WHERE "views" >= $2 AND "viewsThreshold" = $3
             RETURNING id`,
                [index + 1, thresh, index],
              );
              return res;
            },
          ),
        ),
    );
    await Promise.all(
      updatedIds.map((ids, index) =>
        Promise.all(
          ids.map(({ id }) =>
            notifyPostReachedViewsThreshold(console, id, thresholds[index]),
          ),
        ),
      ),
    );
  },
};

export default cron;
