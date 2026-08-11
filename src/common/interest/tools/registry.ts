import type { UserInterest } from '../../../entity/UserInterest';
import type { InterestToolContext, InterestToolDefinition } from './context';
import { addFindingTool } from './addFinding';
import { discoverExternalTool } from './discoverExternal';
import { getSourceTool } from './getSource';
import { getTagTool } from './getTag';
import { queryFeedTool } from './queryFeed';
import { readCommentsTool } from './readComments';
import { readPostTool } from './readPost';
import { searchDailyDevTool } from './searchDailyDev';
import { searchSourcesTool } from './searchSources';
import { searchTagsTool } from './searchTags';
import { setInterestTagsTool } from './setInterestTags';
import { setRunSummaryTool } from './setRunSummary';
import { writePostTool } from './writePost';

type ToolGate = 'feed' | 'post' | 'web';

const registry: {
  create: (ctx: InterestToolContext) => InterestToolDefinition;
  gate?: ToolGate;
}[] = [
  { create: setInterestTagsTool },
  { create: searchDailyDevTool },
  { create: queryFeedTool },
  { create: readPostTool },
  { create: readCommentsTool },
  { create: getSourceTool },
  { create: getTagTool },
  { create: searchTagsTool },
  { create: searchSourcesTool },
  { create: setRunSummaryTool },
  { create: addFindingTool, gate: 'feed' },
  { create: discoverExternalTool, gate: 'web' },
  { create: writePostTool, gate: 'post' },
];

const isGateOpen = (
  gate: ToolGate | undefined,
  outputModes?: UserInterest['outputModes'],
  sources?: UserInterest['sources'],
): boolean => {
  const feed = outputModes?.feed ?? true;
  switch (gate) {
    case 'feed':
      return feed;
    // External discovery writes findings, so it needs the feed output too.
    case 'web':
      return feed && !!sources?.web;
    case 'post':
      return outputModes?.post ?? true;
    default:
      return true;
  }
};

export const createInterestToolDefinitions = (
  ctx: InterestToolContext,
): InterestToolDefinition[] =>
  registry
    .filter(({ gate }) =>
      isGateOpen(gate, ctx.interest.outputModes, ctx.interest.sources),
    )
    .map(({ create }) => create(ctx));
