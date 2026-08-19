import { z } from 'zod';
import { UserVote } from '../../types';

export const voteToolSchema = z.object({
  id: z.uuid(),
  vote: z.literal([UserVote.Down, UserVote.None, UserVote.Up]),
});
