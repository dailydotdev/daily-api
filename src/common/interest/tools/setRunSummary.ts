import { Type } from 'typebox';
import type { InterestToolContext } from './context';
import { MAX_RUN_SUMMARY_LENGTH, jsonResult } from './constants';

export const setRunSummaryTool = ({ state }: InterestToolContext) => ({
  name: 'set_run_summary',
  label: 'Set run summary',
  description: `Write the summary the user sees in their notification. One or two short sentences, at most ${MAX_RUN_SUMMARY_LENGTH} characters; anything longer is truncated. Sell the single most interesting thing being delivered, in plain language, without counts-only phrasing. This is product copy read by someone who knows nothing about how you work: never mention tools, tool errors, budgets, limits, scores, thresholds, filtered results, tags, feeds, or anything else internal, and never apologise or explain what you could not do. See <output_voice>.`,
  parameters: Type.Object({
    summary: Type.String(),
  }),
  execute: async (_id: never, params: { summary: string }) => {
    const summary = params.summary.trim().replace(/\s+/g, ' ');
    state.agentSummary = summary
      ? summary.slice(0, MAX_RUN_SUMMARY_LENGTH)
      : null;
    return jsonResult({ saved: true });
  },
});
