import '../src/config';
import { z } from 'zod';
import createOrGetConnection from '../src/db';
import { logger } from '../src/logger';
import { getClickHouseClient } from '../src/common/clickhouse';
import { CampaignPost, CampaignState, CampaignType } from '../src/entity';
import { usdToCores } from '../src/common/number';

const skadiCampaignClickhouseSchema = z.object({
  campaign_id: z.uuid(),
  user_id: z.string(),
  post_id: z.string(),
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  impressions: z.coerce.number().min(0),
  clicks: z.coerce.number().min(0),
  unique_users: z.coerce.number().min(0),
  active: z.coerce.boolean(), // active is returned as string 1|0
  cancelled: z.preprocess((val) => {
    // cancelled is returned as string true|false
    return val === 'false' ? false : Boolean(val);
  }, z.boolean()),
  budget: z.coerce.number().min(0),
  current_budget: z.coerce.number().min(0),
});

const campaignStateFromSkadi = ({
  item,
}: {
  item: z.infer<typeof skadiCampaignClickhouseSchema>;
}): CampaignState => {
  if (item.cancelled) {
    return CampaignState.Cancelled;
  }

  if (item.active) {
    return CampaignState.Active;
  }

  return CampaignState.Completed;
};

/**
 * Load all campaigns from skadi, no filters because it had small amount of rows < 1000
 *
 * If any campaign exists in db already, skip it
 *
 * All rows are imported as CampaignPost
 *
 */
const main = async () => {
  const clickhouseClient = getClickHouseClient();

  const queryParams = {};

  const response = await clickhouseClient.query({
    query: /* sql */ `
      WITH campaigns AS (
      SELECT
        id,
        JSONExtractString(metadata, 'user_id') user_id,
        JSONExtractString(metadata, 'post_id') post_id,
        JSONExtractString(metadata, 'cancelled') cancelled,
        active,
        start_date,
        end_date,
        budget
      FROM
        skadi.campaigns_pg
      WHERE
        JSONExtractString(metadata, 'report_type') = 'post_boost'
        AND user_id != ''
        AND post_id != ''),
          minmax AS (
      SELECT
        id,
        min(start_date) OVER () AS min_date,
        max(end_date) OVER () AS max_date
      FROM
        campaigns)
      SELECT
        campaigns.id AS campaign_id,
        campaigns.user_id AS user_id,
        campaigns.post_id AS post_id,
        campaigns.start_date AS start_date,
        campaigns.end_date AS end_date,
        sum(aid.impressions) AS impressions,
        sum(acd.clicks) AS clicks,
        uniqIfMerge(aid.unique_users) AS unique_users,
        campaigns.active AS active,
        campaigns.cancelled AS cancelled,
        campaigns.budget AS budget,
        IF(csp.current_budget < 0, 0, csp.current_budget) AS current_budget
      FROM
        skadi.ad_impressions_daily aid FINAL
      LEFT JOIN skadi.ad_clicks_daily acd FINAL ON
        aid.campaign_id = acd.campaign_id
      LEFT JOIN campaigns ON
        aid.campaign_id = toString(campaigns.id)
      LEFT JOIN minmax ON
        aid.campaign_id = toString(minmax.id)
      LEFT JOIN skadi.campaign_states_pg csp ON
        aid.campaign_id = toString(csp.id)
      WHERE
        aid.event_date BETWEEN minmax.min_date AND minmax.max_date
        AND aid.campaign_id IN (
        SELECT
          id
        FROM
          campaigns)
      GROUP BY
        campaign_id,
        active,
        start_date,
        end_date,
        user_id,
        post_id,
        minmax.min_date,
        minmax.max_date,
        budget,
        current_budget,
        cancelled;
    `,
    format: 'JSONEachRow',
    query_params: queryParams,
  });

  const result = z
    .array(skadiCampaignClickhouseSchema)
    .safeParse(await response.json());

  if (!result.success) {
    logger.error(
      {
        schemaError: result.error.issues[0],
      },
      'Invalid campaign data',
    );

    throw new Error('Invalid campaign data');
  }

  const { data } = result;

  const chunks: CampaignPost[][] = [];
  const chunkSize = 500;

  data.forEach((item) => {
    if (chunks.length === 0 || chunks[chunks.length - 1].length === chunkSize) {
      chunks.push([]);
    }

    chunks[chunks.length - 1].push({
      id: item.campaign_id,
      referenceId: item.post_id,
      userId: item.user_id,
      type: CampaignType.Post,
      endedAt: item.end_date,
      state: campaignStateFromSkadi({ item }),
      flags: {
        budget: usdToCores(item.budget),
        spend: usdToCores(item.budget - item.current_budget),
        impressions: item.impressions,
        clicks: item.clicks,
        users: item.unique_users,
        __imported: true,
      },
      postId: item.post_id,
      createdAt: item.start_date,
    } as CampaignPost);
  });

  const con = await createOrGetConnection();

  await con.transaction(async (entityManager) => {
    for (const chunk of chunks) {
      if (chunk.length === 0) {
        continue;
      }

      await entityManager
        .createQueryBuilder()
        .insert()
        .into(CampaignPost)
        .values(chunk)
        .orIgnore()
        .execute();
    }
  });

  logger.info({ rows: data.length, queryParams }, 'synced campaign data');

  process.exit();
};

main();
