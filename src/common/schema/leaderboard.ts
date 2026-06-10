import { z } from 'zod';
import { enumValues } from './utils';

export enum LeaderboardPositionType {
  HighestReputation = 'highestReputation',
  LongestStreak = 'longestStreak',
  MostReadingDays = 'mostReadingDays',
}

export const leaderboardPositionSchema = z.object({
  type: z.enum(enumValues(LeaderboardPositionType)),
});
