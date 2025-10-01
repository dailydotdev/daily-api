import z from 'zod';
import { IResolvers } from '@graphql-tools/utils';
import { traceResolvers } from './trace';
import { AuthContext, BaseContext, type Context } from '../Context';
import graphorm from '../graphorm';
import {
  Opportunity,
  OpportunityContent,
  OpportunityState,
  ScreeningQuestionsRequest,
} from '@dailydotdev/schema';
import { OpportunityMatch } from '../entity/OpportunityMatch';
import { toGQLEnum } from '../common';
import { OpportunityMatchStatus } from '../entity/opportunities/types';
import { UserCandidatePreference } from '../entity/user/UserCandidatePreference';
import type { GQLEmptyResponse } from './common';
import {
  candidatePreferenceSchema,
  uploadEmploymentAgreementSchema,
  userCandidateToggleKeywordSchema,
} from '../common/schema/userCandidate';
import { Alerts } from '../entity';
import { opportunityScreeningAnswersSchema } from '../common/schema/opportunityMatch';
import { OpportunityJob } from '../entity/opportunities/OpportunityJob';
import { ForbiddenError } from 'apollo-server-errors';
import { ConflictError, NotFoundError } from '../errors';
import { UserCandidateKeyword } from '../entity/user/UserCandidateKeyword';
import { EMPLOYMENT_AGREEMENT_BUCKET_NAME } from '../config';
import {
  deleteEmploymentAgreementByUserId,
  uploadEmploymentAgreementFromBuffer,
} from '../common/googleCloud';
import { opportunityEditSchema } from '../common/schema/opportunities';
import { OpportunityKeyword } from '../entity/OpportunityKeyword';
import {
  ensureOpportunityPermissions,
  OpportunityPermissions,
} from '../common/opportunity/accessControl';
import { markdown } from '../common/markdown';
import { QuestionScreening } from '../entity/questions/QuestionScreening';
import { In, Not } from 'typeorm';
import { getGondulClient } from '../common/gondul';
import { createOpportunityPrompt } from '../common/opportunity/prompt';

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
  extends Omit<
    UserCandidatePreference,
    'userId' | 'user' | 'updatedAt' | 'cvParsed'
  > {
  keywords?: Array<{ keyword: string }>;
}

export type GQLOpportunityScreeningQuestion = Pick<
  QuestionScreening,
  'id' | 'title' | 'placeholder' | 'opportunityId'
> & {
  order: number;
};

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
    order: Int!
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

  type GCSBlob {
    blob: String
    fileName: String
    contentType: String
    lastModified: DateTime
  }

  type UserCandidateKeyword {
    keyword: String!
  }

  type UserCandidatePreference {
    status: ProtoEnumValue!
    cv: GCSBlob
    employmentAgreement: GCSBlob
    role: String
    roleType: Float
    employmentType: [ProtoEnumValue]!
    salaryExpectation: SalaryExpectation
    location: [Location]!
    locationType: [ProtoEnumValue]!
    companyStage: [ProtoEnumValue]!
    companySize: [ProtoEnumValue]!
    customKeywords: Boolean
    keywords: [UserCandidateKeyword!]!
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
    subdivision: String
    type: ProtoEnumValue
  }

  input OpportunityScreeningAnswerInput {
    questionId: ID!
    answer: String!
  }

  input SalaryInput {
    min: Float
    max: Float
    period: ProtoEnumValue
  }

  input OpportunityMetaInput {
    employmentType: ProtoEnumValue
    teamSize: Int
    salary: SalaryInput
    seniorityLevel: ProtoEnumValue
    roleType: Float
  }

  input OpportunityKeywordInput {
    keyword: String!
  }

  input OpportunityContentBlockInput {
    content: String
  }

  input OpportunityContentInput {
    overview: OpportunityContentBlockInput
    responsibilities: OpportunityContentBlockInput
    requirements: OpportunityContentBlockInput
    whatYoullDo: OpportunityContentBlockInput
    interviewProcess: OpportunityContentBlockInput
  }

  input OpportunityScreeningQuestionInput {
    id: ID
    title: String!
    placeholder: String
  }

  input OpportunityEditInput {
    title: String
    tldr: String
    meta: OpportunityMetaInput
    location: [LocationInput]
    keywords: [OpportunityKeywordInput]
    content: OpportunityContentInput
    questions: [OpportunityScreeningQuestionInput!]
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
      customKeywords: Boolean
    ): EmptyResponse @auth

    saveOpportunityScreeningAnswers(
      """
      Id of the Opportunity
      """
      id: ID!

      answers: [OpportunityScreeningAnswerInput!]!
    ): EmptyResponse @auth

    acceptOpportunityMatch(
      """
      Id of the Opportunity
      """
      id: ID!
    ): EmptyResponse @auth

    candidateAddKeywords(
      """
      Keywords to add to candidate profile
      """
      keywords: [String!]!
    ): EmptyResponse @auth

    candidateRemoveKeywords(
      """
      Keywords to remove from candidate profile
      """
      keywords: [String!]!
    ): EmptyResponse @auth

    uploadEmploymentAgreement(
      """
      Asset to upload
      """
      file: Upload!
    ): EmptyResponse @auth @rateLimit(limit: 5, duration: 60)

    clearEmploymentAgreement: EmptyResponse
      @auth
      @rateLimit(limit: 5, duration: 60)

    editOpportunity(
      """
      Id of the Opportunity
      """
      id: ID!

      """
      Opportunity data to update
      """
      payload: OpportunityEditInput!
    ): Opportunity! @auth

    recommendOpportunityScreeningQuestions(
      """
      Id of the Opportunity
      """
      id: ID!
    ): [OpportunityScreeningQuestion!]! @auth
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
      ctx: Context,
      info,
    ): Promise<GQLOpportunity> => {
      const opportunity = await graphorm.queryOneOrFail<GQLOpportunity>(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder.where({ id });

          builder.queryBuilder.addSelect(`${builder.alias}.state`, 'state');

          return builder;
        },
      );

      if (opportunity.state !== OpportunityState.LIVE) {
        if (!ctx.userId) {
          throw new NotFoundError('Not found!');
        }

        await ensureOpportunityPermissions({
          con: ctx.con.manager,
          userId: ctx.userId,
          opportunityId: id,
          permission: OpportunityPermissions.Edit,
        });
      }

      return opportunity;
    },
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
    ): Promise<GQLUserCandidatePreference> => {
      const preferences = await graphorm.queryOne<GQLUserCandidatePreference>(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder.where({ userId: ctx.userId });
          return builder;
        },
      );

      if (preferences) {
        return preferences;
      }

      return {
        ...new UserCandidatePreference(),
        keywords: [],
      };
    },
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

      const [match, opportunity] = await Promise.all([
        con.getRepository(OpportunityMatch).findOneBy({
          opportunityId,
          userId,
          status: OpportunityMatchStatus.Pending,
        }),
        con.getRepository(OpportunityJob).findOneOrFail({
          where: { id: opportunityId, state: OpportunityState.LIVE },
          relations: {
            questions: true,
          },
        }),
      ]);

      if (!match) {
        throw new ForbiddenError(`Access denied! Match is not pending`);
      }

      const questions = await opportunity.questions;

      // Check if the number of answers matches the number of questions
      if (answers.length !== questions.length) {
        log.error(
          { answers, questions, opportunityId },
          'Answer count mismatch',
        );
        throw new ConflictError(
          `Number of answers (${answers.length}) does not match the required questions`,
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
          throw new ConflictError(
            `Question ${answer.questionId} not found for opportunity`,
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
    acceptOpportunityMatch: async (
      _,
      { id }: { id: string },
      { userId, con, log }: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      const match = await con.getRepository(OpportunityMatch).findOne({
        where: {
          opportunityId: id,
          userId,
        },
        relations: {
          opportunity: true,
        },
      });

      if (!match) {
        log.error(
          { opportunityId: id, userId },
          'No match found for opportunity',
        );
        throw new ForbiddenError('Access denied! No match found');
      }

      if (match.status !== OpportunityMatchStatus.Pending) {
        log.error(
          { opportunityId: id, userId, status: match.status },
          'Match is not pending',
        );
        throw new ForbiddenError(`Access denied! Match is not pending`);
      }

      const opportunity = await match.opportunity;
      if (opportunity.state !== OpportunityState.LIVE) {
        log.error(
          { opportunityId: id, userId, state: opportunity.state },
          'Opportunity is not live',
        );
        throw new ForbiddenError(`Access denied! Opportunity is not live`);
      }

      await con.getRepository(OpportunityMatch).update(
        {
          opportunityId: id,
          userId,
        },
        {
          status: OpportunityMatchStatus.CandidateAccepted,
        },
      );

      return { _: true };
    },
    candidateAddKeywords: async (
      _,
      payload: z.infer<typeof userCandidateToggleKeywordSchema>,
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      const { data, error } =
        userCandidateToggleKeywordSchema.safeParse(payload);
      if (error) {
        throw error;
      }

      const rows = data.keywords.map((keyword) => ({
        userId: ctx.userId,
        keyword,
      }));

      await ctx.con.getRepository(UserCandidateKeyword).upsert(rows, {
        conflictPaths: ['userId', 'keyword'],
        skipUpdateIfNoValuesChanged: true,
      });

      return { _: true };
    },
    candidateRemoveKeywords: async (
      _,
      payload: z.infer<typeof userCandidateToggleKeywordSchema>,
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      const { data, error } =
        userCandidateToggleKeywordSchema.safeParse(payload);
      if (error) {
        throw error;
      }

      const rows = data.keywords.map((keyword) => ({
        userId: ctx.userId,
        keyword,
      }));

      await ctx.con.getRepository(UserCandidateKeyword).delete(rows);

      return { _: true };
    },
    uploadEmploymentAgreement: async (
      _,
      payload: z.infer<typeof uploadEmploymentAgreementSchema>,
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      const { data, error } =
        await uploadEmploymentAgreementSchema.safeParseAsync(payload);
      if (error) {
        throw error;
      }

      const { file } = data;

      const blobName = ctx.userId;
      await uploadEmploymentAgreementFromBuffer(blobName, file.buffer, {
        contentType: file.mimetype,
      });

      await ctx.con.getRepository(UserCandidatePreference).upsert(
        {
          userId: ctx.userId,
          employmentAgreement: {
            blob: blobName,
            fileName: file.filename,
            contentType: file.mimetype,
            bucket: EMPLOYMENT_AGREEMENT_BUCKET_NAME,
            lastModified: new Date(),
          },
        },
        {
          conflictPaths: ['userId'],
          skipUpdateIfNoValuesChanged: true,
        },
      );

      return { _: true };
    },
    clearEmploymentAgreement: async (
      _,
      __,
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      const isDeleted = await deleteEmploymentAgreementByUserId({
        userId: ctx.userId,
        logger: ctx.log,
      });

      if (!isDeleted) {
        ctx.log.warn(
          { userId: ctx.userId },
          'Failed to delete employment agreement from GCS',
        );
        throw new Error('Failed to delete employment agreement');
      }

      await ctx.con.getRepository(UserCandidatePreference).update(
        {
          userId: ctx.userId,
        },
        {
          employmentAgreement: {},
        },
      );
      return { _: true };
    },
    editOpportunity: async (
      _,
      {
        id,
        payload,
      }: { id: string; payload: z.infer<typeof opportunityEditSchema> },
      ctx: AuthContext,
      info,
    ): Promise<GQLOpportunity> => {
      const opportunity = opportunityEditSchema.parse(payload);

      await ensureOpportunityPermissions({
        con: ctx.con.manager,
        userId: ctx.userId,
        opportunityId: id,
        permission: OpportunityPermissions.Edit,
      });

      await ctx.con.transaction(async (entityManager) => {
        const { keywords, content, questions, ...opportunityUpdate } =
          opportunity;

        const renderedContent: Record<
          string,
          { content: string; html: string }
        > = {};

        Object.entries(content || {}).forEach(([key, value]) => {
          if (typeof value.content !== 'string') {
            return;
          }

          renderedContent[key] = {
            content: value.content.replace(/'/g, "''"),
            html: markdown.render(value.content).replace(/'/g, "''"),
          };
        });

        const opportunityContent = new OpportunityContent(renderedContent);

        await entityManager
          .getRepository(OpportunityJob)
          .createQueryBuilder()
          .update({
            ...opportunityUpdate,
            content: () => `content || :contentJson`,
            meta: () => `meta || :metaJson`,
          })
          .where({ id })
          .setParameter('contentJson', opportunityContent.toJsonString())
          .setParameter('metaJson', JSON.stringify(opportunity.meta || {}))
          .execute();

        if (Array.isArray(keywords)) {
          await entityManager.getRepository(OpportunityKeyword).delete({
            opportunityId: id,
          });

          await entityManager.getRepository(OpportunityKeyword).insert(
            keywords.map((keyword) => ({
              opportunityId: id,
              keyword: keyword.keyword,
            })),
          );
        }

        if (Array.isArray(questions)) {
          const questionIds = questions.map((item) => item.id).filter(Boolean);

          const hasQuestionsFromOtherOpportunity = await entityManager
            .getRepository(QuestionScreening)
            .exists({
              where: { id: In(questionIds), opportunityId: Not(id) },
            });

          if (hasQuestionsFromOtherOpportunity) {
            throw new ConflictError('Not allowed to edit some questions!');
          }

          await entityManager.getRepository(QuestionScreening).delete({
            id: Not(In(questionIds)),
            opportunityId: id,
          });

          await entityManager.getRepository(QuestionScreening).upsert(
            questions.map((question, index) => {
              return entityManager.getRepository(QuestionScreening).create({
                id: question.id,
                opportunityId: id,
                title: question.title,
                placeholder: question.placeholder,
                questionOrder: index,
              });
            }),
            { conflictPaths: ['id'] },
          );
        }
      });

      return graphorm.queryOneOrFail<GQLOpportunity>(ctx, info, (builder) => {
        builder.queryBuilder.where({ id });

        return builder;
      });
    },
    recommendOpportunityScreeningQuestions: async (
      _,
      { id }: { id: string },
      ctx: AuthContext,
    ): Promise<GQLOpportunityScreeningQuestion[]> => {
      await ensureOpportunityPermissions({
        con: ctx.con.manager,
        userId: ctx.userId,
        opportunityId: id,
        permission: OpportunityPermissions.Edit,
      });

      const hasQuestionsAlready = await ctx.con
        .getRepository(QuestionScreening)
        .exists({
          where: { opportunityId: id },
        });

      if (hasQuestionsAlready) {
        throw new ConflictError('Opportunity already has questions!');
      }

      const opportunity = await ctx.con
        .getRepository(OpportunityJob)
        .findOneOrFail({
          where: { id },
          relations: {
            organization: true,
          },
        });

      const gondulClient = getGondulClient();

      const result = await gondulClient.garmr.execute(async () => {
        return await gondulClient.instance.screeningQuestions(
          new ScreeningQuestionsRequest({
            jobOpportunity: createOpportunityPrompt({ opportunity }),
          }),
        );
      });

      const savedQuestions = await ctx.con
        .getRepository(QuestionScreening)
        .save(
          result.screening.map((question, index) => {
            return ctx.con.getRepository(QuestionScreening).create({
              opportunityId: id,
              title: question,
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
    },
  },
});
