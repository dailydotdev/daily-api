import { In } from 'typeorm';
import { AudienceFitRequest } from '@dailydotdev/schema';
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
import { getBragiClient } from '../../integrations/bragi/clients';
import { triggerTypedEvent } from '../../common/typedPubsub';
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

      const matches = await con
        .getRepository(UserInterest)
        .createQueryBuilder('ui')
        .select(['ui.id', 'ui.userId', 'ui.fomoThreshold', 'ui.outputModes'])
        .innerJoin(
          FeedTag,
          'ft',
          'ft."feedId" = ui."feedId" AND ft.blocked = false',
        )
        .where('ui.status = :status', { status: UserInterestStatus.Active })
        .andWhere('ft.tag IN (:...keywords)', { keywords })
        .getMany();

      if (!matches.length) {
        return;
      }

      const maxInterestsPerPost =
        remoteConfig.vars.interestAgentMaxInterestsPerPost ??
        defaultMaxInterestsPerPost;
      const limited = matches.slice(0, maxInterestsPerPost);
      if (matches.length > maxInterestsPerPost) {
        logger.warn(
          { postId: post.id, matched: matches.length },
          'post-visible interest match capped',
        );
      }

      const existing = await con.getRepository(InterestFinding).find({
        select: ['interestId'],
        where: {
          postId: post.id,
          interestId: In(limited.map((interest) => interest.id)),
        },
      });
      const alreadyFound = new Set(existing.map((row) => row.interestId));

      const bragiClient = getBragiClient();

      for (const interest of limited) {
        if (alreadyFound.has(interest.id)) {
          continue;
        }

        const response = await bragiClient.garmr.execute(() =>
          bragiClient.instance.audienceFit(
            new AudienceFitRequest({
              title: post.title ?? '',
              content: post.summary ?? '',
              contentType: post.type,
            }),
          ),
        );

        if (response.audienceFit < (interest.fomoThreshold ?? 0.5)) {
          continue;
        }

        if (interest.outputModes?.feed ?? true) {
          await con
            .getRepository(InterestFinding)
            .createQueryBuilder()
            .insert()
            .values({
              id: await generateShortId(),
              interestId: interest.id,
              postId: post.id,
              score: response.audienceFit,
              rationale: 'Matched a newly published post by tag overlap',
              status: InterestFindingStatus.Surfaced,
            })
            .orIgnore()
            .execute();
        }

        if (interest.outputModes?.notification ?? true) {
          await triggerTypedEvent(logger, 'api.v1.interest-content-available', {
            interestId: interest.id,
            postId: post.id,
            userId: interest.userId,
          });
        }
      }
    },
  };
