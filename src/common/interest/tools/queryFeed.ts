import { Type } from 'typebox';
import { KeywordStatus } from '../../../entity/Keyword';
import { Source } from '../../../entity/Source';
import { getForYouByTagFeedGenerator } from '../../../integrations/feed/generators';
import { getFeedResponsePostIds } from '../../../integrations/feed/types';
import { queryReadReplica } from '../../queryReadReplica';
import type { InterestToolContext } from './context';
import {
  type FeedOrder,
  type FeedScope,
  resolveLimit,
  resolveOffset,
} from './candidates';
import {
  CANDIDATE_OVERFETCH,
  DEFAULT_TAG_SCOPE_PERIOD_DAYS,
  budgetError,
  jsonResult,
} from './constants';

export const queryFeedTool = ({
  con,
  log,
  interest,
  excludedSourceIds,
  consumeBudget,
  pipeline,
}: InterestToolContext) => ({
  name: 'query_feed',
  label: 'Query daily.dev feed',
  description: `Read a ranked daily.dev feed. scope "interest" uses this interest's saved tags, "tags" uses tags you supply, "source" reads one source's posts (pass sourceId), "tag" reads one tag's posts (pass tag). The interest and tags scopes run through the same ranking the user's own feed uses: engagement-ranked, and filtered by their blocked tags, blocked sources, blocked words and followed sources, so results are already shaped to this reader. They need tags to exist, and work at topic granularity rather than phrase granularity. No publish-date restriction, so these scopes reach older posts the interest has never seen. The source and tag scopes support orderBy "date" or "upvotes" plus an optional period in days; they have no relevance ranker, so "relevance" falls back to "upvotes" there. The tag scope windows to the last ${DEFAULT_TAG_SCOPE_PERIOD_DAYS} days unless you pass a larger period; the response reports the ordering and window actually applied. orderBy and period do not apply to the interest and tags scopes and are reported back as ignored. Page with nextOffset from the response, not by adding your limit: offset counts inventory rows and more are read than returned.`,
  parameters: Type.Object({
    scope: Type.Optional(
      Type.Union([
        Type.Literal('interest'),
        Type.Literal('tags'),
        Type.Literal('source'),
        Type.Literal('tag'),
      ]),
    ),
    tags: Type.Optional(Type.Array(Type.String())),
    sourceId: Type.Optional(Type.String()),
    tag: Type.Optional(Type.String()),
    orderBy: Type.Optional(
      Type.Union([
        Type.Literal('relevance'),
        Type.Literal('date'),
        Type.Literal('upvotes'),
      ]),
    ),
    period: Type.Optional(Type.Number()),
    limit: Type.Optional(Type.Number()),
    offset: Type.Optional(Type.Number()),
  }),
  execute: async (
    _id: never,
    params: {
      scope?: FeedScope;
      tags?: string[];
      sourceId?: string;
      tag?: string;
      orderBy?: FeedOrder;
      period?: number;
      limit?: number;
      offset?: number;
    },
  ) => {
    if (consumeBudget()) {
      return jsonResult(budgetError);
    }
    const scope = params.scope ?? 'interest';
    const orderBy = params.orderBy ?? 'relevance';
    const limit = resolveLimit(params.limit);
    const fetched = limit * CANDIDATE_OVERFETCH;
    const offset = resolveOffset(params.offset);

    if (scope === 'source' || scope === 'tag') {
      if (scope === 'source' && !params.sourceId) {
        return jsonResult({ error: 'source_id_required' });
      }
      if (scope === 'tag' && !params.tag) {
        return jsonResult({ error: 'tag_required' });
      }
      if (
        scope === 'source' &&
        params.sourceId &&
        excludedSourceIds.includes(params.sourceId)
      ) {
        return jsonResult({
          error: 'source_excluded',
          hint: 'Collections, trends and digest sources aggregate other posts and cannot be browsed.',
        });
      }
      if (scope === 'source' && params.sourceId) {
        const source = await queryReadReplica(con, ({ queryRunner }) =>
          queryRunner.manager.getRepository(Source).findOne({
            select: ['id', 'private', 'active'],
            where: { id: params.sourceId },
          }),
        );
        if (!source || !source.active || source.private) {
          return jsonResult({ error: 'source_not_found' });
        }
      }

      let tag = params.tag;
      if (scope === 'tag' && params.tag) {
        const resolved = await pipeline.resolveTag(params.tag);
        if (
          !resolved.keyword ||
          resolved.keyword.status !== KeywordStatus.Allow
        ) {
          return jsonResult({
            tag: resolved.requested,
            error: 'tag_not_found',
            hint: 'Use search_tags to find a real tag slug.',
          });
        }
        tag = resolved.keyword.value;
      }

      const { postIds, windowDays } = await pipeline.queryScopedPostIds({
        scope,
        sourceId: params.sourceId,
        tag,
        orderBy,
        period: params.period,
        limit: fetched,
        offset,
      });
      const result = {
        ...(await pipeline.toCandidates({
          postIds,
          limit,
          fetched,
          offset,
          requestedOffset: params.offset,
        })),
        orderBy: orderBy === 'date' ? 'date' : 'upvotes',
        ...(windowDays ? { periodDays: windowDays } : {}),
        ...(scope === 'tag' && tag !== params.tag ? { resolvedTag: tag } : {}),
      };
      log.info(
        {
          interestId: interest.id,
          scope,
          sourceId: params.sourceId,
          tag: params.tag,
          candidateCount: result.candidates.length,
          filtered: result.filtered,
        },
        'interest agent query_feed',
      );
      return jsonResult(result);
    }

    const tags = params.tags?.length
      ? params.tags
      : await pipeline.findTagsForFeed();

    if (!tags.length) {
      return jsonResult({
        candidates: [],
        error: 'no_tags',
        hint: 'Call set_interest_tags first, or pass tags explicitly.',
      });
    }

    const response = await getForYouByTagFeedGenerator(tags).generate(
      pipeline.feedContext,
      {
        user_id: interest.userId,
        page_size: fetched,
        offset,
      },
    );
    const result = {
      ...(await pipeline.toCandidates({
        postIds: getFeedResponsePostIds(response),
        limit,
        fetched,
        offset,
        requestedOffset: params.offset,
      })),
      // These scopes go through the feed service's own ranking, so anything the
      // agent passed here was not applied.
      orderBy: 'relevance',
      ...(params.orderBy && params.orderBy !== 'relevance'
        ? { orderByIgnored: params.orderBy }
        : {}),
      ...(params.period ? { periodIgnored: params.period } : {}),
    };
    log.info(
      {
        interestId: interest.id,
        scope,
        tags,
        feedCount: response.data.length,
        candidateCount: result.candidates.length,
        filtered: result.filtered,
      },
      'interest agent query_feed',
    );
    return jsonResult(result);
  },
});
