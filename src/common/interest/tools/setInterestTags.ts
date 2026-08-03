import { Type } from 'typebox';
import { replaceFeedTags } from '../feedTags';
import type { InterestToolContext } from './context';
import { budgetError, jsonResult } from './constants';

export const setInterestTagsTool = ({
  con,
  interest,
  maxTags,
  overBudget,
  pipeline,
}: InterestToolContext) => ({
  name: 'set_interest_tags',
  label: 'Set interest tags',
  description:
    'Set the daily.dev tags that best represent this interest. Replaces the existing set. These tags outlive the run: they are what query_feed scope "interest" reads, and they are matched against every post published on daily.dev between runs, so a matching post can be caught for this user without an agent run at all. Getting them right is the most durable thing you can do here. Use real daily.dev tag slugs (lowercase, hyphenated) — confirm them with search_tags, because unknown slugs are silently dropped and the response tells you which ones were.',
  parameters: Type.Object({
    tags: Type.Array(Type.String()),
  }),
  execute: async (_id: never, params: { tags: string[] }) => {
    if (overBudget()) {
      return jsonResult(budgetError);
    }
    const feedId = interest.feedId;
    if (!feedId) {
      return jsonResult({ savedTags: [] });
    }
    const valid = await pipeline.findAllowedKeywords(params.tags);
    const validTags = valid.map((keyword) => keyword.value).slice(0, maxTags);
    const dropped = params.tags.filter((tag) => !validTags.includes(tag));
    await replaceFeedTags({ con, feedId, tags: validTags, maxTags });
    return jsonResult({ savedTags: validTags, dropped });
  },
});
