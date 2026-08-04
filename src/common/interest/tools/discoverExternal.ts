import { Type } from 'typebox';
import type { DataSource } from 'typeorm';
import { MoreThanOrEqual } from 'typeorm';
import type { FastifyBaseLogger } from 'fastify';
import {
  InterestFinding,
  InterestFindingOrigin,
  InterestFindingStatus,
} from '../../../entity/InterestFinding';
import { SharePost } from '../../../entity/posts/SharePost';
import {
  createExternalLink,
  createSharePost,
} from '../../../entity/posts/utils';
import type { UserInterest } from '../../../entity/UserInterest';
import { getExistingPost } from '../../post';
import { getDiscussionLink, standardizeURL } from '../../links';
import { blockingBatchRunner } from '../../async';
import { generateShortId } from '../../../ids';
import { remoteConfig } from '../../../remoteConfig';
import { ONE_DAY_IN_SECONDS } from '../../constants';
import {
  discoverExternalUrls,
  type DiscoveredUrl,
} from '../discoverExternalUrls';
import type { InterestToolContext } from './context';
import {
  DEFAULT_MAX_DISCOVERIES_PER_DAY,
  DEFAULT_MAX_WEB_SEARCHES_PER_RUN,
  DISCOVERY_BATCH_SIZE,
  budgetError,
  jsonResult,
} from './constants';

export const discoverAndIngestExternal = async ({
  con,
  logger,
  interest,
  query,
  limit,
}: {
  con: DataSource;
  logger: FastifyBaseLogger;
  interest: Pick<
    UserInterest,
    'id' | 'query' | 'userId' | 'sourceId' | 'fomoThreshold' | 'sources'
  >;
  query: string;
  limit?: number;
}): Promise<{
  discovered: number;
  added: number;
  postIds: string[];
  ingested: { postId: string; title: string | null }[];
}> => {
  if (!interest.sources?.web || !interest.sourceId) {
    return { discovered: 0, added: 0, postIds: [], ingested: [] };
  }
  const sourceId = interest.sourceId;

  const maxPerDay =
    remoteConfig.vars.interestAgentMaxDiscoveriesPerDay ??
    DEFAULT_MAX_DISCOVERIES_PER_DAY;
  const since = new Date(Date.now() - ONE_DAY_IN_SECONDS * 1000);
  const discoveredToday = await con.getRepository(InterestFinding).count({
    where: {
      interestId: interest.id,
      origin: InterestFindingOrigin.Discovery,
      createdAt: MoreThanOrEqual(since),
    },
  });
  const remaining = maxPerDay - discoveredToday;
  if (remaining <= 0) {
    return { discovered: 0, added: 0, postIds: [], ingested: [] };
  }

  const candidates = await discoverExternalUrls({
    interest,
    query,
    limit: Math.min(limit ?? remaining, remaining),
    logger,
  });

  const threshold = interest.fomoThreshold ?? 0.5;
  const seenCanonical = new Set<string>();
  const eligible = candidates.reduce<
    { candidate: DiscoveredUrl; url: string; canonicalUrl: string }[]
  >((acc, candidate) => {
    if (candidate.score < threshold) {
      return acc;
    }
    const { url, canonicalUrl } = standardizeURL(candidate.url);
    if (seenCanonical.has(canonicalUrl)) {
      return acc;
    }
    seenCanonical.add(canonicalUrl);
    acc.push({ candidate, url, canonicalUrl });
    return acc;
  }, []);

  const added: { postId: string; title: string | null }[] = [];
  await blockingBatchRunner({
    data: eligible,
    batchLimit: DISCOVERY_BATCH_SIZE,
    runner: async (batch) => {
      const results = await Promise.all(
        batch.map(async ({ candidate, url, canonicalUrl }) => {
          const existing = await getExistingPost(con, { url, canonicalUrl });
          if (existing?.deleted) {
            return null;
          }
          let articleId = existing?.id;
          if (!articleId) {
            articleId = await generateShortId();
            await createExternalLink({
              con,
              args: {
                id: articleId,
                title: candidate.title || undefined,
                url,
                canonicalUrl,
                authorId: interest.userId,
                originalUrl: candidate.url,
                showOnFeed: false,
              },
            });
          }

          const existingShare = await con.getRepository(SharePost).findOne({
            select: ['id'],
            where: { sourceId, sharedPostId: articleId, deleted: false },
          });
          const shareId =
            existingShare?.id ??
            (
              await createSharePost({
                con,
                args: {
                  authorId: interest.userId,
                  sourceId,
                  postId: articleId,
                  visible: true,
                },
              })
            ).id;

          const insertResult = await con
            .getRepository(InterestFinding)
            .createQueryBuilder()
            .insert()
            .values({
              id: await generateShortId(),
              interestId: interest.id,
              postId: shareId,
              score: candidate.score,
              rationale: candidate.rationale,
              status: InterestFindingStatus.New,
              origin: InterestFindingOrigin.Discovery,
            })
            .orIgnore()
            .execute();
          return (insertResult.raw as unknown[])?.length
            ? { postId: shareId, title: candidate.title || null }
            : null;
        }),
      );
      for (const ingested of results) {
        if (ingested) {
          added.push(ingested);
        }
      }
    },
  });

  logger
    .child({ provider: 'interest agent' })
    .info(
      { interestId: interest.id, query, added: added.length },
      'interest agent discover_external',
    );

  return {
    discovered: candidates.length,
    added: added.length,
    postIds: added.map(({ postId }) => postId),
    ingested: added,
  };
};

export const discoverExternalTool = ({
  con,
  log,
  interest,
  state,
  addedPostIds,
  consumeBudget,
}: InterestToolContext) => {
  let discoverCalls = 0;

  return {
    name: 'discover_external',
    label: 'Discover external content',
    description:
      "Search the web for content matching the interest. Pass a focused search query. Matching pages are ingested into daily.dev and added to the interest's feed as findings, so do not pass them to add_finding. Treat this as an equal inventory to daily.dev search and use it freely on every run — not just when daily.dev is thin. Returns each ingested finding with its title and permalink so you can name and link them in your summary; a null title means the page had none yet, so lead with a different finding. read_post on a returned postId gives the full detail.",
    parameters: Type.Object({
      query: Type.String(),
      limit: Type.Optional(Type.Number()),
    }),
    execute: async (_id: never, params: { query: string; limit?: number }) => {
      if (consumeBudget()) {
        return jsonResult(budgetError);
      }
      const maxCalls =
        remoteConfig.vars.interestAgentMaxWebSearchesPerRun ??
        DEFAULT_MAX_WEB_SEARCHES_PER_RUN;
      discoverCalls += 1;
      if (discoverCalls > maxCalls) {
        return jsonResult({ error: 'web_search_budget_exhausted', maxCalls });
      }

      const result = await discoverAndIngestExternal({
        con,
        logger: log,
        interest,
        query: params.query,
        limit: params.limit,
      });
      result.postIds.forEach((postId) => addedPostIds.add(postId));
      state.findingsAdded += result.added;
      return jsonResult({
        discovered: result.discovered,
        added: result.added,
        findings: result.ingested.map(({ postId, title }) => ({
          postId,
          title,
          permalink: getDiscussionLink(postId),
        })),
      });
    },
  };
};
