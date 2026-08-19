import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import createOrGetConnection from '../../db';
import { queryReadReplica } from '../../common/queryReadReplica';
import { EncoreOfferCompletion } from '../../entity/EncoreOfferCompletion';

const requestSchema = z.object({
  from: z.string().date(),
  to: z.string().date(),
});

type EncoreDailyReportRow = {
  date: string;
  campaignName: string;
  completions: number;
  revenue: number;
};

/**
 * Daily Encore revenue aggregates from the offer-completion ledger, consumed
 * by analytics-processor to feed the ads_daily_report table in BigQuery.
 * Range is [from, to) in UTC.
 */
export const encoreReport = async (fastify: FastifyInstance): Promise<void> => {
  fastify.get('/', async (req, res) => {
    const parsed = requestSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).send({ error: 'Invalid date range' });
    }

    const { from, to } = parsed.data;
    const con = await createOrGetConnection();
    const rows = await queryReadReplica(con, ({ queryRunner }) =>
      queryRunner.manager
        .getRepository(EncoreOfferCompletion)
        .createQueryBuilder('c')
        .select(
          `to_char(c."completedAt" at time zone 'UTC', 'YYYY-MM-DD')`,
          'date',
        )
        .addSelect('c."campaignName"', 'campaignName')
        .addSelect('count(*)::int', 'completions')
        .addSelect(`coalesce(sum(c."payout"), 0)::float`, 'revenue')
        .where(`c."completedAt" >= :from and c."completedAt" < :to`, {
          from,
          to,
        })
        .groupBy('1')
        .addGroupBy('2')
        .orderBy('1')
        .getRawMany<EncoreDailyReportRow>(),
    );

    return res.send({ reports: rows });
  });
};
