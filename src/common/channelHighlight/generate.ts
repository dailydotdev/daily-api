import type { DataSource } from 'typeorm';
import { logger as baseLogger } from '../../logger';
import { ChannelHighlightRun } from '../../entity/ChannelHighlightRun';
import { ChannelHighlightState } from '../../entity/ChannelHighlightState';
import { replaceHighlightsForChannel } from './publish';
import {
  evaluateChannelHighlights,
  type EvaluatedHighlightItem,
} from './evaluate';
import {
  fetchCurrentHighlights,
  fetchDefinitionState,
  fetchIncrementalPosts,
  fetchPostsByIds,
  fetchRelations,
  getFetchStart,
  getHorizonStart,
  mergePosts,
  parseCandidatePool,
} from './queries';
import {
  buildBaselineSnapshot,
  buildStories,
  toStoryCandidate,
} from './stories';
import {
  compareSnapshots,
  reuseEvaluations,
  shouldPublish,
  shouldReuseEvaluations,
  toPoolStory,
} from './decisions';
import type { ChannelHighlightDefinition } from '../../entity/ChannelHighlightDefinition';
import type { GenerateChannelHighlightResult, HighlightStory } from './types';

const MAX_CANDIDATE_POOL_STORIES = 50;
const SHORTLIST_MULTIPLIER = 3;

const buildStoriesByPostId = (
  stories: HighlightStory[],
): Map<string, HighlightStory> => {
  const storiesByPostId = new Map<string, HighlightStory>();

  for (const story of stories) {
    storiesByPostId.set(story.canonicalPost.id, story);
    for (const memberPost of story.memberPosts) {
      storiesByPostId.set(memberPost.id, story);
    }
  }

  return storiesByPostId;
};

const buildInputSummary = ({
  fetchStart,
  horizonStart,
  shortlist,
}: {
  fetchStart: Date;
  horizonStart: Date;
  shortlist: HighlightStory[];
}) => ({
  fetchStart: fetchStart.toISOString(),
  horizonStart: horizonStart.toISOString(),
  shortlist: shortlist.map((story) => ({
    storyKey: story.storyKey,
    canonicalPostId: story.canonicalPost.id,
    preliminaryScore: story.preliminaryScore,
  })),
});

const buildMetrics = ({
  incrementalPosts,
  retainedPosts,
  stories,
  shortlist,
  reusedEvaluation,
}: {
  incrementalPosts: { length: number };
  retainedPosts: { length: number };
  stories: { length: number };
  shortlist: { length: number };
  reusedEvaluation: boolean;
}) => ({
  fetchedPosts: incrementalPosts.length,
  retainedPosts: retainedPosts.length,
  totalStories: stories.length,
  shortlistStories: shortlist.length,
  evaluatedStories: reusedEvaluation ? 0 : shortlist.length,
  reusedEvaluation,
});

const buildCandidatePool = ({
  stories,
  evaluatedItems,
  now,
}: {
  stories: HighlightStory[];
  evaluatedItems: EvaluatedHighlightItem[];
  now: Date;
}) => ({
  stories: stories.slice(0, MAX_CANDIDATE_POOL_STORIES).map((story) =>
    toPoolStory({
      story,
      evaluation: evaluatedItems.find(
        (item) => item.storyKey === story.storyKey,
      ),
      evaluatedAt: now,
    }),
  ),
});

// High-level flow:
// 1. Fetch fresh and retained posts inside the configured horizon.
// 2. Collapse them into story candidates, preferring collections.
// 3. Reuse cached editorial decisions only when the story is truly unchanged.
// 4. Compare the internal result with the live highlights, then persist the run.
export const generateChannelHighlight = async ({
  con,
  definition,
  now = new Date(),
}: {
  con: DataSource;
  definition: ChannelHighlightDefinition;
  now?: Date;
}): Promise<GenerateChannelHighlightResult> => {
  const state = await fetchDefinitionState({
    con,
    channel: definition.channel,
  });
  const previousPool = parseCandidatePool(state?.candidatePool);
  const currentHighlights = await fetchCurrentHighlights({
    con,
    channel: definition.channel,
  });
  const horizonStart = getHorizonStart({
    now,
    definition,
  });
  const fetchStart = getFetchStart({
    now,
    definition,
    state,
  });

  const retainedPostIds = new Set([
    ...previousPool.stories.flatMap((story) => story.memberPostIds),
    ...currentHighlights.map((item) => item.postId),
  ]);
  const retainedPosts = await fetchPostsByIds({
    con,
    ids: [...retainedPostIds],
    horizonStart,
  });
  const incrementalPosts = await fetchIncrementalPosts({
    con,
    channel: definition.channel,
    fetchStart,
    horizonStart,
  });
  const basePosts = mergePosts([retainedPosts, incrementalPosts]);
  const baseRelations = await fetchRelations({
    con,
    postIds: basePosts.map((post) => post.id),
  });
  const relationPosts = await fetchPostsByIds({
    con,
    ids: [
      ...new Set(
        baseRelations.flatMap((relation) => [
          relation.postId,
          relation.relatedPostId,
        ]),
      ),
    ],
    horizonStart,
  });
  const stories = buildStories({
    posts: mergePosts([basePosts, relationPosts]),
    relations: baseRelations,
    previousPool,
    horizonStart,
    referenceTime: now,
  });
  const storiesByPostId = buildStoriesByPostId(stories);
  const shortlist = stories.slice(
    0,
    definition.maxItems * SHORTLIST_MULTIPLIER,
  );
  const baselineSnapshot = buildBaselineSnapshot({
    highlights: currentHighlights,
    storiesByPostId,
  });

  const reusedEvaluation = shouldReuseEvaluations({
    shortlist,
  });
  const evaluatedItems = reusedEvaluation
    ? reuseEvaluations({
        shortlist,
        maxItems: definition.maxItems,
      })
    : (
        await evaluateChannelHighlights({
          channel: definition.channel,
          maxItems: definition.maxItems,
          currentHighlights: baselineSnapshot,
          candidates: shortlist.map(toStoryCandidate),
        })
      ).items;

  const comparison = compareSnapshots({
    baseline: baselineSnapshot,
    internal: evaluatedItems,
  });
  const wouldPublish = shouldPublish({
    baseline: baselineSnapshot,
    internal: evaluatedItems,
  });
  const publish = definition.mode === 'publish' && wouldPublish;
  const metrics = buildMetrics({
    incrementalPosts,
    retainedPosts,
    stories,
    shortlist,
    reusedEvaluation,
  });

  const runRepo = con.getRepository(ChannelHighlightRun);
  let run = runRepo.create({
    channel: definition.channel,
    scheduledAt: now,
    status: 'processing',
    baselineSnapshot,
    inputSummary: buildInputSummary({
      fetchStart,
      horizonStart,
      shortlist,
    }),
    internalSnapshot: [],
    comparison: {},
    metrics,
  });
  run = await runRepo.save(run);

  try {
    await con.transaction(async (manager) => {
      await manager.getRepository(ChannelHighlightState).save({
        channel: definition.channel,
        lastFetchedAt: now,
        lastPublishedAt: publish ? now : state?.lastPublishedAt || null,
        candidatePool: buildCandidatePool({
          stories,
          evaluatedItems,
          now,
        }),
      });

      if (publish) {
        await replaceHighlightsForChannel({
          manager,
          channel: definition.channel,
          items: evaluatedItems.map((item) => ({
            postId: item.postId,
            rank: item.rank,
            headline: item.headline,
          })),
        });
      }

      await manager.getRepository(ChannelHighlightRun).update(
        {
          id: run.id,
        },
        {
          status: 'completed',
          completedAt: new Date(),
          internalSnapshot: evaluatedItems,
          comparison: {
            ...comparison,
            wouldPublish,
            published: publish,
          },
          metrics,
        },
      );
    });

    return {
      run: await runRepo.findOneByOrFail({
        id: run.id,
      }),
      published: publish,
    };
  } catch (err) {
    baseLogger.error(
      { err, channel: definition.channel },
      'Failed channel highlight run',
    );
    await runRepo.update(
      {
        id: run.id,
      },
      {
        status: 'failed',
        completedAt: new Date(),
        error: {
          message: err instanceof Error ? err.message : 'Unknown error',
        },
      },
    );
    throw err;
  }
};
