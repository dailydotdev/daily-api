import { Type } from 'typebox';
import { Post } from '../../../entity/posts/Post';
import {
  InterestFinding,
  InterestFindingOrigin,
  InterestFindingStatus,
} from '../../../entity/InterestFinding';
import { generateShortId } from '../../../ids';
import { excludedInterestPostTypes } from '../exclusions';
import type { InterestToolContext } from './context';
import { jsonResult } from './constants';

export const addFindingTool = ({
  con,
  log,
  interest,
  excludedSourceIds,
  state,
  addedPostIds,
  pipeline,
}: InterestToolContext) => ({
  name: 'add_finding',
  label: 'Add to interest feed',
  description:
    "Add a topically-relevant post to the interest's feed as a finding. Pass your own topical-relevance score (0-1) and a short rationale. Rejects scores below the interest's FOMO threshold, posts already found for this interest, and aggregation posts such as collections, trends and digests.",
  parameters: Type.Object({
    postId: Type.String(),
    score: Type.Number({ minimum: 0, maximum: 1 }),
    rationale: Type.String(),
  }),
  execute: async (
    _id: never,
    params: { postId: string; score: number; rationale: string },
  ) => {
    // Both on primary: this must see findings inserted earlier in this run.
    const [post, delivered] = await Promise.all([
      con.getRepository(Post).findOne({
        select: ['id', 'type', 'sourceId'],
        where: {
          id: params.postId,
          private: false,
          deleted: false,
          banned: false,
          visible: true,
          showOnFeed: true,
        },
      }),
      pipeline.getDeliveredIds([params.postId], con.manager),
    ]);
    if (!post) {
      return jsonResult({
        postId: params.postId,
        added: false,
        error: 'not_public',
      });
    }
    if (
      excludedInterestPostTypes.includes(post.type) ||
      excludedSourceIds.includes(post.sourceId)
    ) {
      return jsonResult({
        postId: params.postId,
        added: false,
        error: 'excluded_content_type',
      });
    }
    const score = params.score;
    const threshold = interest.fomoThreshold ?? 0.5;
    if (score < threshold) {
      return jsonResult({
        postId: params.postId,
        added: false,
        error: 'below_fomo_threshold',
        score,
        threshold,
      });
    }

    if (delivered.has(params.postId)) {
      return jsonResult({
        postId: params.postId,
        added: false,
        error: 'already_delivered',
      });
    }

    const insertResult = await con
      .getRepository(InterestFinding)
      .createQueryBuilder()
      .insert()
      .values({
        id: await generateShortId(),
        interestId: interest.id,
        postId: params.postId,
        score,
        rationale: params.rationale,
        status: InterestFindingStatus.New,
        origin: InterestFindingOrigin.Search,
      })
      .orIgnore()
      .execute();

    if (!(insertResult.raw as unknown[])?.length) {
      return jsonResult({
        postId: params.postId,
        added: false,
        error: 'already_delivered',
      });
    }

    addedPostIds.add(params.postId);
    state.findingsAdded += 1;
    log.info(
      {
        interestId: interest.id,
        postId: params.postId,
        score,
        rationale: params.rationale,
      },
      'interest agent add_finding',
    );
    return jsonResult({ postId: params.postId, added: true });
  },
});
