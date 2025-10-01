import { Raw } from 'typeorm';
import { IResolvers } from '@graphql-tools/utils';
import { UserSkill } from '../entity/user/UserSkill';
import { Company } from '../entity/Company';
import { AuthContext, BaseContext } from '../Context';
import { traceResolvers } from './trace';
import {
  ExperienceStatus,
  ProjectLinkType,
  UserExperienceType,
  WorkEmploymentType,
  WorkLocationType,
  WorkVerificationStatus,
} from '../entity/user/experiences/types';
import { queryReadReplica } from '../common/queryReadReplica';
import { UserExperience } from '../entity/user/experiences/UserExperience';
import {
  autocomplete,
  AutocompleteInput,
  CompanyAutocompleteInput,
  ExperienceAutocompleteInput,
  ExperienceQueryParams,
  ExperienceRemoveParams,
  experiences,
  EXPERIENCES_QUERY_LIMIT,
  experienceTypeToRepositoryMap,
  ExperienceUpdateParams,
  getEmptyExperienceTypesMap,
} from '../common/userExperience';
import { GQLEmptyResponse } from './common';
import { toGQLEnum } from '../common';

// Common fields for all user experience types
const baseUserExperienceFields = `
  id: ID!
  userId: String!
  title: String!
  description: String
  startDate: DateTime!
  endDate: DateTime
  type: UserExperienceType!
  status: ExperienceStatus!
  skills: [SkillHit!]
  flags: JSONObject
`;

export const typeDefs = /* GraphQL */ `
  ${toGQLEnum(UserExperienceType, 'UserExperienceType')}
  ${toGQLEnum(ExperienceStatus, 'ExperienceStatus')}
  ${toGQLEnum(WorkEmploymentType, 'WorkEmploymentType')}
  ${toGQLEnum(WorkLocationType, 'WorkLocationType')}
  ${toGQLEnum(ProjectLinkType, 'ProjectLinkType')}
  ${toGQLEnum(WorkVerificationStatus, 'WorkVerificationStatus')}

  type ExperienceHit {
    id: ID!
    title: String
  }

  type CompanyHit {
    id: ID!
    name: String!
    image: String
  }

  type SkillHit {
    slug: String!
    name: String!
  }

  type ProjectLink {
    type: ProjectLinkType!
    url: String!
  }

  interface UserExperience {
    ${baseUserExperienceFields}
  }

  type UserWorkExperience implements UserExperience {
    ${baseUserExperienceFields}
    companyId: String!
    company: CompanyHit
    employmentType: WorkEmploymentType!
    location: String
    locationType: WorkLocationType
    achievements: [String!]
    # verificationEmail is intentionally not exposed to the frontend
    verificationStatus: WorkVerificationStatus
  }

  type UserEducationExperience implements UserExperience {
    ${baseUserExperienceFields}
    schoolId: String!
    school: CompanyHit
    fieldOfStudy: String!
    grade: String
    extracurriculars: String
  }

  type UserProjectExperience implements UserExperience {
    ${baseUserExperienceFields}
    links: [ProjectLink!]
    contributors: [String!]
    workingExperienceId: String
    workingExperience: UserWorkExperience
    educationExperienceId: String
    educationExperience: UserEducationExperience
  }

  type UserCertificationExperience implements UserExperience {
    ${baseUserExperienceFields}
    courseNumber: String
    companyId: String!
    company: CompanyHit
    credentialId: String
    credentialUrl: String
  }

  type UserAwardExperience implements UserExperience {
    ${baseUserExperienceFields}
    issuer: String
    workingExperienceId: String
    workingExperience: UserWorkExperience
    educationExperienceId: String
    educationExperience: UserEducationExperience
  }

  type UserPublicationExperience implements UserExperience {
    ${baseUserExperienceFields}
    publisher: String
    url: String
    contributors: [String!]
    workingExperienceId: String
    workingExperience: UserWorkExperience
    educationExperienceId: String
    educationExperience: UserEducationExperience
  }

  type UserCourseExperience implements UserExperience {
    ${baseUserExperienceFields}
    courseNumber: String
    institution: String
  }

  type ExperienceAutocompleteResult {
    query: String!
    limit: Int
    hits: [ExperienceHit!]!
  }

  type CompanyAutocompleteResult {
    query: String!
    limit: Int
    hits: [CompanyHit!]!
  }

  type SkillAutocompleteResult {
    query: String!
    limit: Int
    hits: [SkillHit!]!
  }

  type UserExperiencesResult {
    work: [UserWorkExperience!]
    education: [UserEducationExperience!]
    project: [UserProjectExperience!]
    certification: [UserCertificationExperience!]
    award: [UserAwardExperience!]
    publication: [UserPublicationExperience!]
    course: [UserCourseExperience!]
  }

  extend type Query {
    """
    Get autocomplete suggestions for experience fields like job titles, certifications, awards, etc.
    """
    experienceAutocomplete(
      type: String!
      query: String!
      limit: Int
    ): ExperienceAutocompleteResult! @auth

    """
    Get autocomplete suggestions for companies
    """
    companyAutocomplete(
      query: String!
      limit: Int
      type: String
    ): CompanyAutocompleteResult! @auth

    """
    Get autocomplete suggestions for skills
    """
    skillAutocomplete(query: String!, limit: Int): SkillAutocompleteResult!
      @auth

    """
    Get user experiences grouped by type
    """
    userExperiences(status: [ExperienceStatus!]): UserExperiencesResult! @auth
  }

  input ProjectLinkInput {
    type: ProjectLinkType!
    url: String!
  }

  # Union input type for updateExperience
  input ExperienceUpdateInput {
    # Base fields
    title: String
    description: String
    startDate: DateTime
    endDate: DateTime
    status: ExperienceStatus
    type: UserExperienceType!

    # Work experience fields
    companyId: String
    employmentType: WorkEmploymentType
    location: String
    locationType: WorkLocationType
    achievements: [String!]

    # Education experience fields
    schoolId: String
    fieldOfStudy: String
    grade: String
    extracurriculars: String

    # Project experience fields
    links: [ProjectLinkInput!]
    contributors: [String!]
    workingExperienceId: String
    educationExperienceId: String

    # Certification experience fields
    courseNumber: String
    credentialId: String
    credentialUrl: String

    # Award experience fields
    issuer: String

    # Publication experience fields
    publisher: String
    url: String

    # Course experience fields
    institution: String
  }

  extend type Mutation {
    """
    Remove a user experience by ID
    """
    removeExperience(id: ID!): EmptyResponse! @auth

    """
    Update a user experience
    """
    updateExperience(id: ID!, input: ExperienceUpdateInput!): EmptyResponse! @auth
  }
`;

export const resolvers: IResolvers<unknown, BaseContext> = traceResolvers<
  unknown,
  BaseContext
>({
  Query: {
    experienceAutocomplete: async (
      _,
      params: ExperienceAutocompleteInput,
      ctx: AuthContext,
    ) => {
      const {
        data,
        success: passedValidation,
        error,
      } = autocomplete.validation.experience.safeParse(params);

      if (!passedValidation) {
        return autocomplete.handleValidationError(error, params);
      }

      const { type, query, limit }: ExperienceAutocompleteInput = data;
      const propertyName = autocomplete.propertyByType[
        type
      ] as keyof UserExperience;

      const hits: Array<Partial<UserExperience>> = await queryReadReplica(
        ctx.con,
        ({ queryRunner }) =>
          queryRunner.manager
            .getRepository(UserExperience)
            .createQueryBuilder()
            .select(`id`)
            .addSelect(propertyName)
            .where({
              [propertyName]: Raw(() => `${propertyName} ILIKE :query`, {
                query: `%${query}%`,
              }),
              status: ExperienceStatus.Published,
            })
            .orderBy(propertyName, 'ASC')
            .limit(limit)
            .getRawMany(),
      );

      return {
        query,
        limit,
        hits: hits.map(({ id, [propertyName]: title }) => ({ id, title })),
      };
    },
    companyAutocomplete: async (
      _,
      params: CompanyAutocompleteInput,
      ctx: AuthContext,
    ) => {
      const {
        data,
        success: passedValidation,
        error,
      } = autocomplete.validation.company.safeParse(params);

      if (!passedValidation) {
        return autocomplete.handleValidationError(error, params);
      }

      const { query, limit, type }: CompanyAutocompleteInput = data;

      const hits: Array<Pick<Company, 'id' | 'name' | 'image'>> =
        await queryReadReplica(ctx.con, ({ queryRunner }) =>
          queryRunner.manager
            .getRepository(Company)
            .createQueryBuilder()
            .select(['id', 'name', 'image'])
            .where({
              name: Raw(() => `name ILIKE :query`, {
                query: `%${query}%`,
              }),
              type,
            })
            .orderBy('name', 'ASC')
            .limit(limit)
            .getRawMany(),
        );

      return {
        query,
        limit,
        hits,
      };
    },
    skillAutocomplete: async (
      _,
      params: AutocompleteInput,
      ctx: AuthContext,
    ) => {
      const {
        data,
        success: passedValidation,
        error,
      } = autocomplete.validation.base.safeParse(params);

      if (!passedValidation) {
        return autocomplete.handleValidationError(error, params);
      }

      const { query, limit }: AutocompleteInput = data;

      const hits = await queryReadReplica(ctx.con, ({ queryRunner }) =>
        queryRunner.manager
          .getRepository(UserSkill)
          .createQueryBuilder()
          .select(['slug', 'name'])
          .where({
            name: Raw(() => `name ILIKE :query`, {
              query: `%${query}%`,
            }),
          })
          .orderBy('name', 'ASC')
          .limit(limit)
          .getRawMany(),
      );

      return {
        query,
        limit,
        hits,
      };
    },
    userExperiences: async (
      _,
      params: ExperienceQueryParams,
      ctx: AuthContext,
    ) => {
      const { userId } = ctx;

      const {
        data,
        success: passedValidation,
        error,
      } = experiences.validation.queryAll.safeParse(params);

      if (!passedValidation) {
        throw new Error(`Invalid parameters: ${error.message}`);
      }

      const { status } = data;

      const entries = await queryReadReplica(ctx.con, ({ queryRunner }) =>
        queryRunner.manager
          .getRepository(UserExperience)
          .createQueryBuilder('experience')
          .where('experience.userId = :userId', { userId })
          .andWhere('experience.status IN (:...status)', {
            status,
          })
          .addOrderBy('experience.endDate', 'DESC', 'NULLS FIRST')
          .addOrderBy('experience.startDate', 'DESC')
          .limit(EXPERIENCES_QUERY_LIMIT)
          .getMany(),
      );

      return entries.reduce((acc, entry) => {
        return { ...acc, [entry.type]: [...acc[entry.type], entry] };
      }, getEmptyExperienceTypesMap());
    },
  },
  Mutation: {
    removeExperience: async (
      _,
      params: ExperienceRemoveParams,
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      const {
        data,
        success: passedValidation,
        error,
      } = experiences.validation.remove.safeParse(params);

      if (!passedValidation) {
        throw new Error(`Invalid parameters: ${error.message}`);
      }

      await ctx.con
        .getRepository(UserExperience)
        .createQueryBuilder()
        .delete()
        .where({ id: data.id, userId: ctx.userId })
        .execute();

      return { _: true };
    },
    updateExperience: async (
      _,
      params: {
        id: string;
        input: ExperienceUpdateParams;
      },
      ctx: AuthContext,
    ) => {
      const {
        data,
        success: passedValidation,
        error,
      } = experiences.validation.update.safeParse(params.input);

      const { id } = params;
      if (!passedValidation) {
        throw new Error(`Invalid parameters: ${error.message}`);
      }

      await queryReadReplica(ctx.con, ({ queryRunner }) =>
        queryRunner.manager
          .getRepository(UserExperience)
          .findOneByOrFail({ id, userId: ctx.userId, type: data.type }),
      );

      await ctx.con
        .getRepository(experienceTypeToRepositoryMap[data.type])
        .update({ id, userId: ctx.userId, type: data.type }, data);

      return { _: true };
    },
  },
});
