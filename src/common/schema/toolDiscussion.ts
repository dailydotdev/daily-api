import { z } from 'zod';
import { UserVote } from '../../types';

export const voteToolSchema = z.object({
  id: z.uuid(),
  vote: z.literal([UserVote.Down, UserVote.None, UserVote.Up]),
});

export const commentOnToolSchema = z.object({
  id: z.uuid(),
  content: z.string().trim().min(1).max(2000),
  parentId: z.uuid().nullish(),
});
