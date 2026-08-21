import { z } from 'zod';
import { UserVote } from '../../types';

export const voteToolSchema = z.object({
  id: z.uuid(),
  vote: z.literal([UserVote.Down, UserVote.None, UserVote.Up]),
});

// Shared by every single-tool mutation (initToolDiscussion, claimTool,
// unclaimTool, ...) so a malformed id fails validation instead of a raw
// Postgres 22P02 error against the uuid column.
export const toolIdSchema = z.object({
  id: z.uuid(),
});
