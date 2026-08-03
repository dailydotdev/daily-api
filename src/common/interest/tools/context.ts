import type { DataSource } from 'typeorm';
import type { FastifyBaseLogger } from 'fastify';
import type { UserInterest } from '../../../entity/UserInterest';
import type { createCandidatePipeline } from './candidates';

export type InterestAgentRunState = {
  findingsAdded: number;
  summaryPostId: string | null;
  agentSummary: string | null;
};

export type InterestToolContext = {
  con: DataSource;
  log: FastifyBaseLogger;
  logger: FastifyBaseLogger;
  interest: UserInterest;
  excludedSourceIds: string[];
  maxTags: number;
  pendingCount: number;
  state: InterestAgentRunState;
  addedPostIds: Set<string>;
  overBudget: () => boolean;
  pipeline: ReturnType<typeof createCandidatePipeline>;
};

export type InterestToolDefinition = {
  name: string;
  label: string;
  description: string;
  parameters: unknown;
  execute: (
    id: never,
    params: never,
  ) => Promise<{ content: { type: string; text: string }[]; details: object }>;
};
