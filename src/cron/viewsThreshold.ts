import { Cron } from './cron';

type UpdateResult = { id: string }[];

export const viewsThresholds = [250, 500];

const cron: Cron = {
  subscription: 'views-threshold-sub',
  handler: async (con) => {
    await con.transaction(
      async (entityManager): Promise<UpdateResult[]> =>
        Promise.all(
          viewsThresholds.map(async (thresh, index): Promise<UpdateResult> => {
            const [res]: UpdateResult[] = await entityManager.query(
              `UPDATE "post"
             SET "viewsThreshold" = $1
             WHERE "views" >= $2 AND "viewsThreshold" = $3
             RETURNING id`,
              [index + 1, thresh, index],
            );
            return res;
          }),
        ),
    );
  },
};

export default cron;
