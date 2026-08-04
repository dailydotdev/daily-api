import { Type } from 'typebox';
import { SearchRequest, type SearchResponse } from '@dailydotdev/schema';
import { mimirClient } from '../../../integrations/mimir/clients';
import { mimirFilterBuilder } from '../../../integrations/mimir/filters';
import type { InterestToolContext } from './context';
import { resolveLimit, resolveOffset } from './candidates';
import { SEARCH_VERSION, budgetError, jsonResult } from './constants';

export const searchDailyDevTool = ({
  log,
  interest,
  consumeBudget,
  pipeline,
}: InterestToolContext) => ({
  name: 'search_daily_dev',
  label: 'Search daily.dev',
  description:
    "Keyword search across the whole daily.dev corpus. The only tool that turns free text into posts without needing a tag, source or seed post first, so it reaches things the tag vocabulary cannot name: a specific project, a library, a phrase, a niche technique. In exchange it applies no personalisation — the user's blocked tags, blocked sources, blocked words and followed sources are all ignored here, and results are ranked by textual match rather than engagement. Restricted to content published since the previous run, so it is narrow on a recurring interest and widest on the first run. Returns candidates with id, title, canonical url, publish date, upvotes and comment count. To page deeper into the same query use nextOffset from the response, not your own limit: offset counts index rows and more are read than returned. The response also reports how many results were filtered out and whether the index was exhausted.",
  parameters: Type.Object({
    query: Type.String(),
    limit: Type.Optional(Type.Number()),
    offset: Type.Optional(Type.Number()),
  }),
  execute: async (
    _id: never,
    params: { query: string; limit?: number; offset?: number },
  ) => {
    if (consumeBudget()) {
      return jsonResult(budgetError);
    }
    const limit = resolveLimit(params.limit);
    const offset = resolveOffset(params.offset);
    const response: SearchResponse = await mimirClient.search(
      new SearchRequest({
        query: params.query,
        version: SEARCH_VERSION,
        offset,
        limit,
        filters: mimirFilterBuilder({
          publishedAfter: interest.lastRunAt ?? undefined,
        }),
      }),
    );
    const postIds = response.result.map((item) => item.postId).filter(Boolean);
    const result = await pipeline.toCandidates({
      postIds,
      limit,
      offset,
      requestedOffset: params.offset,
    });
    log.info(
      {
        interestId: interest.id,
        query: params.query,
        mimirCount: response.result.length,
        candidateCount: result.candidates.length,
        filtered: result.filtered,
      },
      'interest agent search_daily_dev',
    );
    return jsonResult(result);
  },
});
