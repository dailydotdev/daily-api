/**
 * Mock implementation functions for opportunity-related resolvers.
 * These functions encapsulate the mock logic to keep schema resolvers clean.
 */

import { OpportunityState } from '@dailydotdev/schema';
import { DataSource, IsNull, Not } from 'typeorm';
import { GraphQLResolveInfo } from 'graphql';
import type { DeepPartial } from 'typeorm';
import { OpportunityJob } from '../../entity/opportunities/OpportunityJob';
import { Opportunity } from '../../entity/opportunities/Opportunity';
import { OpportunityKeyword } from '../../entity/OpportunityKeyword';
import { OpportunityUserRecruiter } from '../../entity/opportunities/user';
import { QuestionScreening } from '../../entity/questions/QuestionScreening';
import { updateFlagsStatement } from '../../common/utils';
import { graphorm } from '../../graphorm';
import { addOpportunityDefaultQuestionFeedback } from '../../common/opportunity/common';
import {
  mockParsedOpportunity,
  mockPreviewData,
  mockScreeningQuestions,
} from './index';

interface MockParseOpportunityParams {
  con: DataSource;
  userId?: string;
  trackingId?: string;
  opportunityMatchBatchSize: number;
  info: GraphQLResolveInfo;
  ctx: unknown;
}

/**
 * Mock implementation for parseOpportunity mutation.
 * Creates an opportunity with mock data instead of calling Brokkr/Scraper.
 */
export async function mockParseOpportunity({
  con,
  userId,
  trackingId,
  opportunityMatchBatchSize,
  info,
  ctx,
}: MockParseOpportunityParams): Promise<unknown> {
  const opportunityResult = await con.transaction(async (entityManager) => {
    const flags: Opportunity['flags'] = {};

    if (!userId) {
      flags.anonUserId = trackingId;
    }
    flags.batchSize = opportunityMatchBatchSize;

    let organizationId: string | null | undefined;
    if (userId) {
      const existingOrganizationOpportunity = await entityManager
        .getRepository(OpportunityJob)
        .findOne({
          select: ['id', 'organizationId'],
          where: {
            users: { userId },
            organizationId: Not(IsNull()),
          },
        });
      if (existingOrganizationOpportunity) {
        organizationId = existingOrganizationOpportunity.organizationId;
      }
    }

    const opportunity = await entityManager.getRepository(OpportunityJob).save(
      entityManager.getRepository(OpportunityJob).create({
        type: mockParsedOpportunity.type,
        title: mockParsedOpportunity.title,
        tldr: mockParsedOpportunity.tldr,
        meta: mockParsedOpportunity.meta,
        state: OpportunityState.DRAFT,
        content: mockParsedOpportunity.content,
        flags,
        organizationId,
      } as unknown as DeepPartial<OpportunityJob>),
    );

    await addOpportunityDefaultQuestionFeedback({
      entityManager,
      opportunityId: opportunity.id,
    });

    if (mockParsedOpportunity.keywords) {
      await entityManager.getRepository(OpportunityKeyword).insert(
        mockParsedOpportunity.keywords.map((keyword) => ({
          opportunityId: opportunity.id,
          keyword: keyword.keyword,
        })),
      );
    }

    if (userId) {
      await entityManager.getRepository(OpportunityUserRecruiter).insert(
        entityManager.getRepository(OpportunityUserRecruiter).create({
          opportunityId: opportunity.id,
          userId,
        }),
      );
    }

    return opportunity;
  });

  return await graphorm.queryOneOrFail(ctx, info, (builder) => {
    builder.queryBuilder.where({ id: opportunityResult.id });
    return builder;
  });
}

interface MockOpportunityPreviewParams {
  con: DataSource;
  opportunityId: string;
}

interface OpportunityPreviewResult {
  userIds: string[];
  totalCount: number;
  status: number;
}

/**
 * Mock implementation for opportunityPreview query.
 * Returns mock preview data and updates the opportunity flags.
 */
export async function mockOpportunityPreview({
  con,
  opportunityId,
}: MockOpportunityPreviewParams): Promise<OpportunityPreviewResult> {
  const opportunityPreview: OpportunityPreviewResult = {
    userIds: mockPreviewData.userIds,
    totalCount: mockPreviewData.totalCount,
    status: mockPreviewData.status,
  };

  await con.getRepository(OpportunityJob).update(
    { id: opportunityId },
    {
      flags: updateFlagsStatement<OpportunityJob>({
        preview: opportunityPreview,
      }),
    },
  );

  return opportunityPreview;
}

interface MockScreeningQuestionsParams {
  con: DataSource;
  opportunityId: string;
}

interface GQLOpportunityScreeningQuestion {
  id: string;
  opportunityId: string;
  title: string;
  placeholder: string | null;
  order: number;
}

/**
 * Mock implementation for recommendOpportunityScreeningQuestions mutation.
 * Saves and returns mock screening questions instead of calling Gondul.
 */
export async function mockRecommendScreeningQuestions({
  con,
  opportunityId,
}: MockScreeningQuestionsParams): Promise<GQLOpportunityScreeningQuestion[]> {
  const savedQuestions = await con.getRepository(QuestionScreening).save(
    mockScreeningQuestions.map((question, index) => {
      return con.getRepository(QuestionScreening).create({
        opportunityId,
        title: question.title,
        placeholder: question.placeholder,
        questionOrder: index,
      });
    }),
  );

  return savedQuestions.map((question) => {
    return {
      ...question,
      order: question.questionOrder,
    };
  });
}
