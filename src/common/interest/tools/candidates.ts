import type { DataSource, EntityManager } from 'typeorm';
import { In } from 'typeorm';
import type { FastifyBaseLogger } from 'fastify';
import type { Context } from '../../../Context';
import { Post } from '../../../entity/posts/Post';
import { PostKeyword } from '../../../entity/PostKeyword';
import { View } from '../../../entity/View';
import { Keyword, KeywordStatus } from '../../../entity/Keyword';
import { FeedTag } from '../../../entity/FeedTag';
import { InterestFinding } from '../../../entity/InterestFinding';
import type { UserInterest } from '../../../entity/UserInterest';
import { queryReadReplica } from '../../queryReadReplica';
import { getDiscussionLink } from '../../links';
import { ONE_DAY_IN_SECONDS } from '../../constants';
import { excludedInterestPostTypes } from '../exclusions';
import {
  DEFAULT_SEARCH_LIMIT,
  DEFAULT_TAG_SCOPE_PERIOD_DAYS,
  MAX_CANDIDATE_OFFSET,
  MAX_SEARCH_LIMIT,
} from './constants';

export type FeedScope = 'interest' | 'tags' | 'source' | 'tag';
export type FeedOrder = 'date' | 'upvotes';

export const resolveLimit = (limit?: number) =>
  Math.min(Math.max(limit ?? DEFAULT_SEARCH_LIMIT, 1), MAX_SEARCH_LIMIT);

// Deep offsets scan and discard every skipped row, so cap what the agent can ask for.
export const resolveOffset = (offset?: number) =>
  Math.min(Math.max(offset ?? 0, 0), MAX_CANDIDATE_OFFSET);

export const createCandidatePipeline = ({
  con,
  log,
  interest,
  excludedSourceIds,
}: {
  con: DataSource;
  log: FastifyBaseLogger;
  interest: UserInterest;
  excludedSourceIds: string[];
}) => {
  // `manager` decides primary vs replica: candidate filtering tolerates lag,
  // but add_finding must see findings this same run already inserted.
  const getDeliveredIds = async (
    postIds: string[],
    manager: EntityManager,
  ): Promise<Set<string>> => {
    const rows = await manager
      .getRepository(InterestFinding)
      .createQueryBuilder('f')
      .select(['f."postId" AS "postId"', 'p."sharedPostId" AS "sharedPostId"'])
      .innerJoin(Post, 'p', 'p.id = f."postId"')
      .where('f."interestId" = :interestId', { interestId: interest.id })
      .andWhere(
        '(f."postId" IN (:...postIds) OR p."sharedPostId" IN (:...postIds))',
        { postIds },
      )
      .getRawMany<{ postId: string; sharedPostId: string | null }>();

    const delivered = new Set<string>();
    rows.forEach((row) => {
      delivered.add(row.postId);
      if (row.sharedPostId) {
        delivered.add(row.sharedPostId);
      }
    });
    return delivered;
  };

  /**
   * Turns ranked post ids from a backing inventory into deliverable candidates.
   * `limit` is how many ids the inventory was asked for, so a short result can
   * be reported as "source exhausted" rather than "everything filtered".
   */
  const toCandidates = async ({
    postIds,
    limit,
    offset,
    requestedOffset,
  }: {
    postIds: string[];
    limit: number;
    offset: number;
    requestedOffset?: number;
  }) => {
    const exhausted = postIds.length < limit;
    const nextOffset = offset + limit;
    const paging = {
      offset,
      offsetClamped: offset !== (requestedOffset ?? offset),
      ...(nextOffset <= MAX_CANDIDATE_OFFSET
        ? { nextOffset }
        : { pagingLimitReached: true }),
    };
    const empty = {
      candidates: [],
      requested: limit,
      filtered: { alreadyDelivered: 0, alreadyViewed: 0, unavailable: 0 },
      exhausted,
      ...paging,
    };
    if (!postIds.length) {
      return empty;
    }

    // Separate replica calls so each gets its own connection and they run in
    // parallel; a single queryRunner would serialise them.
    const [delivered, viewed] = await Promise.all([
      queryReadReplica(con, ({ queryRunner }) =>
        getDeliveredIds(postIds, queryRunner.manager),
      ),
      queryReadReplica(con, ({ queryRunner }) =>
        queryRunner.manager
          .getRepository(View)
          .createQueryBuilder('v')
          .select('DISTINCT v."postId"', 'postId')
          .where('v."userId" = :userId', { userId: interest.userId })
          .andWhere('v."postId" IN (:...postIds)', { postIds })
          .getRawMany<{ postId: string }>(),
      ),
    ]);
    const viewedIds = new Set(viewed.map((row) => row.postId));

    const alreadyDelivered = postIds.filter((id) => delivered.has(id)).length;
    const alreadyViewed = postIds.filter(
      (id) => !delivered.has(id) && viewedIds.has(id),
    ).length;
    const freshIds = postIds.filter(
      (id) => !delivered.has(id) && !viewedIds.has(id),
    );
    if (!freshIds.length) {
      return {
        ...empty,
        filtered: { alreadyDelivered, alreadyViewed, unavailable: 0 },
      };
    }

    const posts = await queryReadReplica(con, ({ queryRunner }) =>
      queryRunner.manager
        .getRepository(Post)
        .createQueryBuilder('p')
        .select([
          'p.id AS id',
          'p.title AS title',
          'p.slug AS slug',
          'p."createdAt" AS "createdAt"',
          'p.upvotes AS upvotes',
          'p.comments AS comments',
        ])
        .where('p.id IN (:...freshIds)', { freshIds })
        .andWhere('p.private = false')
        .andWhere('p.deleted = false')
        .andWhere('p.banned = false')
        .andWhere('p.visible = true')
        .andWhere('p."showOnFeed" = true')
        .andWhere('p.type NOT IN (:...excludedTypes)', {
          excludedTypes: excludedInterestPostTypes,
        })
        .andWhere('p."sourceId" NOT IN (:...excludedSourceIds)', {
          excludedSourceIds,
        })
        .getRawMany<{
          id: string;
          title: string | null;
          slug: string | null;
          createdAt: Date;
          upvotes: number;
          comments: number;
        }>(),
    );

    // `IN (...)` does not preserve order, so re-apply the inventory's ranking.
    const byId = new Map(posts.map((post) => [post.id, post]));
    const ordered = freshIds.map((id) => byId.get(id)).filter((post) => !!post);

    return {
      candidates: ordered.map((post) => ({
        postId: post.id,
        title: post.title,
        url: getDiscussionLink(post.slug ?? post.id),
        publishedAt: post.createdAt.toISOString(),
        upvotes: post.upvotes,
        comments: post.comments,
      })),
      requested: limit,
      filtered: {
        alreadyDelivered,
        alreadyViewed,
        unavailable: freshIds.length - posts.length,
      },
      exhausted,
      ...paging,
    };
  };

  // post_keyword rows inherit keyword.status via trigger, so a synonym's rows are
  // never 'allow' — querying one directly returns nothing. Resolve to canonical first.
  const resolveTag = async (tag: string) => {
    const findKeyword = (value: string) =>
      queryReadReplica(con, ({ queryRunner }) =>
        queryRunner.manager
          .getRepository(Keyword)
          .findOne({ where: { value } }),
      );
    const requested = tag.trim().toLowerCase();
    const initial = await findKeyword(requested);
    if (initial?.status === KeywordStatus.Synonym && initial.synonym) {
      return {
        requested,
        keyword: await findKeyword(initial.synonym),
        resolvedFrom: initial.value,
      };
    }
    return { requested, keyword: initial, resolvedFrom: null };
  };

  const queryScopedPostIds = async ({
    scope,
    sourceId,
    tag,
    orderBy,
    period,
    limit,
    offset,
  }: {
    scope: 'source' | 'tag';
    sourceId?: string;
    tag?: string;
    orderBy: FeedOrder;
    period?: number;
    limit: number;
    offset: number;
  }) =>
    queryReadReplica(con, async ({ queryRunner }) => {
      // The tag scope drives off post_keyword (IDX_post_keyword_status_keyword_postid)
      // instead of filtering posts with an EXISTS subquery: for a narrow tag the
      // planner would otherwise walk the post ordering index probing per row.
      const builder =
        scope === 'tag'
          ? queryRunner.manager
              .getRepository(PostKeyword)
              .createQueryBuilder('pk')
              .select('p.id', 'id')
              .innerJoin(Post, 'p', 'p.id = pk."postId"')
              .where('pk.keyword = :tag', { tag })
              .andWhere('pk.status = :keywordStatus', {
                keywordStatus: KeywordStatus.Allow,
              })
          : queryRunner.manager
              .getRepository(Post)
              .createQueryBuilder('p')
              .select('p.id', 'id')
              .where('p."sourceId" = :sourceId', { sourceId });

      builder
        .andWhere('p.deleted = false')
        .andWhere('p.private = false')
        .andWhere('p.banned = false')
        .andWhere('p.visible = true')
        .andWhere('p."showOnFeed" = true')
        .andWhere('p.type NOT IN (:...excludedTypes)', {
          excludedTypes: excludedInterestPostTypes,
        })
        .andWhere('p."sourceId" NOT IN (:...excludedSourceIds)', {
          excludedSourceIds,
        })
        .limit(limit)
        .offset(offset);

      const windowDays =
        period ?? (scope === 'tag' ? DEFAULT_TAG_SCOPE_PERIOD_DAYS : undefined);
      if (windowDays) {
        builder.andWhere('p."createdAt" >= :since', {
          since: new Date(Date.now() - windowDays * ONE_DAY_IN_SECONDS * 1000),
        });
      }

      builder.orderBy(
        orderBy === 'date' ? 'p."createdAt"' : 'p.upvotes',
        'DESC',
      );

      const rows = await builder.getRawMany<{ id: string }>();
      return { postIds: rows.map((row) => row.id), windowDays };
    });

  const feedContext = { con, log } as unknown as Context;

  const findViewed = (postId: string) =>
    queryReadReplica(con, ({ queryRunner }) =>
      queryRunner.manager.getRepository(View).findOne({
        select: ['postId'],
        where: { userId: interest.userId, postId },
      }),
    );

  const findDelivered = (postId: string) =>
    queryReadReplica(con, ({ queryRunner }) =>
      queryRunner.manager.getRepository(InterestFinding).findOne({
        select: ['createdAt'],
        where: { interestId: interest.id, postId },
      }),
    );

  const findTagsForFeed = async () =>
    (
      await queryReadReplica(con, ({ queryRunner }) =>
        queryRunner.manager.getRepository(FeedTag).find({
          select: ['tag'],
          where: { feedId: interest.feedId ?? '' },
        }),
      )
    ).map((row) => row.tag);

  /**
   * Normalises and synonym-resolves a batch of agent-supplied slugs the same way
   * resolveTag does for a single one, in two queries rather than two per tag.
   */
  const resolveTags = async (tags: string[]) => {
    const requested = [...new Set(tags.map((tag) => tag.trim().toLowerCase()))];
    if (!requested.length) {
      return { resolved: [], unknown: [] };
    }
    const rows = await queryReadReplica(con, ({ queryRunner }) =>
      queryRunner.manager.getRepository(Keyword).find({
        select: ['value', 'status', 'synonym'],
        where: { value: In(requested) },
      }),
    );
    const byValue = new Map(rows.map((row) => [row.value, row]));

    const canonicalNeeded = rows
      .filter((row) => row.status === KeywordStatus.Synonym && row.synonym)
      .map((row) => row.synonym as string);
    const allowedCanonical = canonicalNeeded.length
      ? new Set(
          (
            await queryReadReplica(con, ({ queryRunner }) =>
              queryRunner.manager.getRepository(Keyword).find({
                select: ['value'],
                where: {
                  value: In(canonicalNeeded),
                  status: KeywordStatus.Allow,
                },
              }),
            )
          ).map((row) => row.value),
        )
      : new Set<string>();

    const resolved: string[] = [];
    const unknown: string[] = [];
    requested.forEach((value) => {
      const row = byValue.get(value);
      if (row?.status === KeywordStatus.Allow) {
        resolved.push(row.value);
        return;
      }
      if (
        row?.status === KeywordStatus.Synonym &&
        row.synonym &&
        allowedCanonical.has(row.synonym)
      ) {
        resolved.push(row.synonym);
        return;
      }
      unknown.push(value);
    });

    return { resolved: [...new Set(resolved)], unknown };
  };

  return {
    getDeliveredIds,
    toCandidates,
    resolveTag,
    queryScopedPostIds,
    feedContext,
    findViewed,
    findDelivered,
    findTagsForFeed,
    resolveTags,
  };
};
