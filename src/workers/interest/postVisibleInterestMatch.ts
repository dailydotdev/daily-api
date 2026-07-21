import { In } from 'typeorm';
import type { TypedWorker } from '../worker';
import { UserInterest, UserInterestStatus } from '../../entity/UserInterest';
import {
  InterestFinding,
  InterestFindingStatus,
} from '../../entity/InterestFinding';
import { PostKeyword } from '../../entity/PostKeyword';
import { KeywordStatus } from '../../entity/Keyword';
import { FeedTag } from '../../entity/FeedTag';
import { PostType } from '../../entity/posts/Post';
import { evaluateInterestRelevance } from '../../common/interest/evaluateInterestRelevance';
import { generateShortId } from '../../ids';
import { remoteConfig } from '../../remoteConfig';

const skippedTypes = new Set<string>([
  PostType.Brief,
  PostType.Digest,
  PostType.Freeform,
]);

const defaultMaxInterestsPerPost = 50;

export const postVisibleInterestMatchWorker: TypedWorker<'api.v1.post-visible'> =
  {
    subscription: 'api.post-visible-interest-match',
    handler: async ({ data }, con, logger): Promise<void> => {
      const { post } = data;

      if (
        !post?.id ||
        post.private ||
        post.deleted ||
        !post.showOnFeed ||
        skippedTypes.has(post.type)
      ) {
        return;
      }

      const keywordRows = await con.getRepository(PostKeyword).find({
        select: ['keyword'],
        where: { postId: post.id, status: KeywordStatus.Allow },
      });
      const keywords = keywordRows.map((row) => row.keyword);
      if (!keywords.length) {
        return;
      }

      const maxInterestsPerPost =
        remoteConfig.vars.interestAgentMaxInterestsPerPost ??
        defaultMaxInterestsPerPost;

      const limited = await con
        .getRepository(UserInterest)
        .createQueryBuilder('ui')
        .select([
          'ui.id',
          'ui.userId',
          'ui.query',
          'ui.feedId',
          'ui.lastRunSummary',
          'ui.fomoThreshold',
          'ui.outputModes',
        ])
        .where('ui.status = :status', { status: UserInterestStatus.Active })
        .andWhere(
          (qb) =>
            `EXISTS ${qb
              .subQuery()
              .select('1')
              .from(FeedTag, 'ft')
              .where('ft."feedId" = ui."feedId"')
              .andWhere('ft.blocked = false')
              .andWhere('ft.tag IN (:...keywords)', { keywords })
              .getQuery()}`,
        )
        .limit(maxInterestsPerPost)
        .getMany();

      if (!limited.length) {
        return;
      }

      const existing = await con.getRepository(InterestFinding).find({
        select: ['interestId'],
        where: {
          postId: post.id,
          interestId: In(limited.map((interest) => interest.id)),
        },
      });
      const alreadyFound = new Set(existing.map((row) => row.interestId));

      const log = logger.child({ provider: 'interest agent' });

      for (const interest of limited) {
        if (alreadyFound.has(interest.id)) {
          continue;
        }

        const relevance = await evaluateInterestRelevance({
          con,
          logger,
          interest,
          post: { id: post.id, title: post.title, summary: post.summary },
        });

        const threshold = interest.fomoThreshold ?? 0.5;
        if (!relevance.relevant || relevance.score < threshold) {
          log.info(
            {
              postId: post.id,
              interestId: interest.id,
              relevant: relevance.relevant,
              score: relevance.score,
              threshold,
              rationale: relevance.rationale,
            },
            'interest match rejected',
          );
          continue;
        }

        if (!(interest.outputModes?.feed ?? true)) {
          log.info(
            {
              postId: post.id,
              interestId: interest.id,
              score: relevance.score,
            },
            'interest match not added (feed output off)',
          );
          continue;
        }

        await con
          .getRepository(InterestFinding)
          .createQueryBuilder()
          .insert()
          .values({
            id: await generateShortId(),
            interestId: interest.id,
            postId: post.id,
            score: relevance.score,
            rationale: relevance.rationale ?? 'Matched a newly published post',
            status: InterestFindingStatus.New,
          })
          .orIgnore()
          .execute();

        log.info(
          {
            postId: post.id,
            interestId: interest.id,
            score: relevance.score,
            rationale: relevance.rationale,
          },
          'interest match added',
        );
      }
    },
  };
