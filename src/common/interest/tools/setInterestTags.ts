import { Type } from 'typebox';
import { replaceFeedTags } from '../feedTags';
import type { InterestToolContext } from './context';
import { jsonResult } from './constants';

export const setInterestTagsTool = ({
  con,
  interest,
  maxTags,
  pipeline,
}: InterestToolContext) => ({
  name: 'set_interest_tags',
  label: 'Set interest tags',
  description:
    'Set the daily.dev tags that best represent this interest. Replaces the existing set. These tags outlive the run: they are what query_feed scope "interest" reads, and they are matched against every post published on daily.dev between runs, so a matching post can be caught for this user without an agent run at all. Getting them right is the most durable thing you can do here. Slugs are lowercased and synonyms resolve to their canonical tag. The response separates unknown slugs, which do not exist and are worth replacing, from overCap slugs, which are real but exceeded the tag limit and can be kept next time by sending fewer.',
  parameters: Type.Object({
    tags: Type.Array(Type.String()),
  }),
  execute: async (_id: never, params: { tags: string[] }) => {
    const feedId = interest.feedId;
    if (!feedId) {
      return jsonResult({ savedTags: [], unknown: [], overCap: [] });
    }
    const { resolved, unknown } = await pipeline.resolveTags(params.tags);
    const savedTags = resolved.slice(0, maxTags);
    const overCap = resolved.slice(maxTags);
    await replaceFeedTags({ con, feedId, tags: savedTags, maxTags });
    return jsonResult({ savedTags, unknown, overCap, maxTags });
  },
});
