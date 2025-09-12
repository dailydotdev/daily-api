import type z from 'zod';
import { IResolvers } from '@graphql-tools/utils';
import { traceResolvers } from './trace';
import { AuthContext, BaseContext } from '../Context';
import graphorm from '../graphorm';
import { Opportunity, OpportunityState } from '@dailydotdev/schema';
import { OpportunityMatch } from '../entity/OpportunityMatch';
import { toGQLEnum } from '../common';
import { OpportunityMatchStatus } from '../entity/opportunities/types';
import { UserCandidatePreference } from '../entity/user/UserCandidatePreference';
import type { GQLEmptyResponse } from './common';
import { candidatePreferenceSchema } from '../common/schema/userCandidate';
import { Alerts } from '../entity';
import { opportunityScreeningAnswersSchema } from '../common/schema/opportunityMatch';
import { OpportunityJob } from '../entity/opportunities/OpportunityJob';

export interface GQLOpportunity
  extends Pick<
    Opportunity,
    'id' | 'type' | 'state' | 'title' | 'tldr' | 'content' | 'keywords'
  > {
  createdAt: Date;
  updatedAt: Date;
}

export interface GQLOpportunityMatch
  extends Pick<OpportunityMatch, 'status' | 'description'> {}

export interface GQLUserCandidatePreference
  extends Omit<UserCandidatePreference, 'id' | 'cvParsed'> {}

export const typeDefs = /* GraphQL */ `
  ${toGQLEnum(OpportunityMatchStatus, 'OpportunityMatchStatus')}

  type OpportunityContentBlock {
    content: String
    html: String!
  }

  type OpportunityContent {
    overview: OpportunityContentBlock
    responsibilities: OpportunityContentBlock
    requirements: OpportunityContentBlock
    whatYoullDo: OpportunityContentBlock
    interviewProcess: OpportunityContentBlock
  }

  type Salary {
    min: Float
    max: Float
    currency: String
    period: ProtoEnumValue
  }

  type SalaryExpectation {
    min: Float
    period: ProtoEnumValue
  }

  type Location {
    city: String
    country: String
    subdivision: String
    continent: String
    type: ProtoEnumValue
  }

  type OpportunityMeta {
    employmentType: ProtoEnumValue
    teamSize: Int
    salary: Salary
    seniorityLevel: ProtoEnumValue
    roleType: Float
  }

  type OpportunityKeyword {
    keyword: String!
  }

  type OpportunityScreeningQuestion {
    id: ID!
    title: String!
    placeholder: String
    opportunityId: ID!
  }

  type Opportunity {
    id: ID!
    type: ProtoEnumValue!
    title: String!
    tldr: String
    content: OpportunityContent!
    meta: OpportunityMeta!
    location: [Location]!
    organization: Organization!
    recruiters: [User!]!
    keywords: [OpportunityKeyword]!
    questions: [OpportunityScreeningQuestion]!
  }

  type OpportunityMatchDescription {
    reasoning: String!
  }

  type OpportunityMatch {
    status: OpportunityMatchStatus!
    description: OpportunityMatchDescription!
  }

  type UserCV {
    blob: String
    contentType: String
    lastModified: DateTime
  }

  type UserCandidatePreference {
    status: ProtoEnumValue!
    cv: UserCV
    role: String
    roleType: Float
    employmentType: [ProtoEnumValue]!
    salaryExpectation: SalaryExpectation
    location: [Location]!
    locationType: [ProtoEnumValue]!
    companyStage: [ProtoEnumValue]!
    companySize: [ProtoEnumValue]!
  }

  extend type Query {
    """
    Get the public information about a Opportunity listing
    """
    opportunityById(
      """
      Id of Opportunity
      """
      id: ID!
    ): Opportunity
    """
    Gets the status and description from the Opportunity match
    """
    getOpportunityMatch(
      """
      Id of the Opportunity
      """
      id: ID!
    ): OpportunityMatch @auth

    """
    Returns the authenticated candidate's saved preferences
    """
    getCandidatePreferences: UserCandidatePreference @auth
  }

  input SalaryExpectationInput {
    min: Float
    period: ProtoEnumValue
  }

  input LocationInput {
    city: String
    country: String
  }

  input OpportunityScreeningAnswerInput {
    questionId: ID!
    answer: String!
  }

  extend type Mutation {
    """
    Updates the authenticated candidate's saved preferences
    """
    updateCandidatePreferences(
      status: ProtoEnumValue
      role: String
      roleType: Float
      employmentType: [ProtoEnumValue]
      salaryExpectation: SalaryExpectationInput
      location: [LocationInput]
      locationType: [ProtoEnumValue]
    ): EmptyResponse @auth

    saveOpportunityScreeningAnswers(
      """
      Id of the Opportunity
      """
      id: ID!

      answers: [OpportunityScreeningAnswerInput!]!
    ): EmptyResponse @auth
  }
`;

export const resolvers: IResolvers<unknown, BaseContext> = traceResolvers<
  unknown,
  BaseContext
>({
  Query: {
    opportunityById: async (
      _,
      { id }: { id: string },
      ctx: AuthContext,
      info,
    ): Promise<GQLOpportunity> =>
      graphorm.queryOneOrFail<GQLOpportunity>(ctx, info, (builder) => {
        builder.queryBuilder
          .where({ id })
          .andWhere({ state: OpportunityState.LIVE });
        return builder;
      }),
    getOpportunityMatch: async (
      _,
      { id }: { id: string },
      ctx: AuthContext,
      info,
    ): Promise<GQLOpportunityMatch> => {
      const match = await graphorm.queryOneOrFail<GQLOpportunityMatch>(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder
            .where({ opportunityId: id })
            .andWhere({ userId: ctx.userId });
          return builder;
        },
      );

      await ctx.con.getRepository(Alerts).update(
        {
          userId: ctx.userId,
          opportunityId: id,
        },
        {
          opportunityId: null,
        },
      );

      return match;
    },
    getCandidatePreferences: async (
      _,
      __,
      ctx: AuthContext,
      info,
    ): Promise<GQLUserCandidatePreference> =>
      graphorm.queryOneOrFail(ctx, info, (builder) => {
        builder.queryBuilder.where({ userId: ctx.userId });
        return builder;
      }),
  },
  Mutation: {
    updateCandidatePreferences: async (
      _,
      payload: z.infer<typeof candidatePreferenceSchema>,
      { userId, con }: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      const preferences = candidatePreferenceSchema.safeParse(payload);

      if (preferences.error) {
        throw preferences.error;
      }

      await con.getRepository(UserCandidatePreference).upsert(
        {
          userId,
          ...preferences.data,
        },
        {
          conflictPaths: ['userId'],
          skipUpdateIfNoValuesChanged: true,
        },
      );

      return { _: true };
    },
    saveOpportunityScreeningAnswers: async (
      _,
      payload: z.infer<typeof opportunityScreeningAnswersSchema>,
      { userId, con, log }: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      const safePayload = opportunityScreeningAnswersSchema.safeParse(payload);
      if (safePayload.error) {
        throw safePayload.error;
      }

      const opportunityId = safePayload.data.id;
      const answers = safePayload.data.answers;

      const opportunity = await con
        .getRepository(OpportunityJob)
        .findOneOrFail({
          where: { id: opportunityId, state: OpportunityState.LIVE },
          relations: {
            questions: true,
          },
        });

      const questions = await opportunity.questions;

      // Check if the number of answers matches the number of questions
      if (answers.length !== questions.length) {
        throw new Error(
          `Number of answers (${answers.length}) does not match number of questions (${questions.length}) for opportunity ${opportunity.id}`,
        );
      }

      // Map answers to questions, throw if question not found
      const screening = answers.map((answer) => {
        const question = questions.find((q) => q.id === answer.questionId);
        if (!question) {
          log.error(
            { answer, questions, opportunityId },
            'Question not found for opportunity',
          );
          throw new Error(
            `Question with id ${answer.questionId} not found for opportunity ${opportunity.id}`,
          );
        }

        return {
          screening: question.title,
          answer: answer.answer,
        };
      });

      await con.getRepository(OpportunityMatch).upsert(
        {
          opportunityId,
          userId,
          screening,
        },
        {
          conflictPaths: ['opportunityId', 'userId'],
          skipUpdateIfNoValuesChanged: true,
        },
      );
      return { _: true };
    },
  },
});
