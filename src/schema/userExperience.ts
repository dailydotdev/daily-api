import { Raw } from 'typeorm';
import { IResolvers } from '@graphql-tools/utils';
import { UserSkill } from '../entity/user/UserSkill';
import { Company } from '../entity/Company';
import { AuthContext, BaseContext } from '../Context';
import { traceResolvers } from './trace';
import {
  ExperienceStatus,
  UserExperienceType,
} from '../entity/user/experiences/types';
import { queryReadReplica } from '../common/queryReadReplica';
import { UserExperience } from '../entity/user/experiences/UserExperience';
import {
  autocomplete,
  AutocompleteInput,
  CompanyAutocompleteInput,
  emptyExperienceTypesMap,
  ExperienceAutocompleteInput,
} from '../common/userExperience';
import { logger } from '../logger';

export const typeDefs = /* GraphQL */ `
  enum UserExperienceType {
    work
    education
    project
    certification
    award
    publication
    course
    open_source
  }

  enum ExperienceStatus {
    draft
    published
  }

  enum WorkEmploymentType {
    full_time
    part_time
    self_employed
    freelance
    contract
    internship
    apprenticeship
    seasonal
  }

  enum WorkLocationType {
    REMOTE
    HYBRID
    ON_SITE
  }

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

  type UserExperience {
    id: ID!
    userId: String!
    title: String!
    description: String
    startDate: DateTime!
    endDate: DateTime
    type: UserExperienceType!
    status: ExperienceStatus!
    skills: [SkillHit!]
  }

  type UserWorkExperience {
    id: ID!
    userId: String!
    title: String!
    description: String
    startDate: DateTime!
    endDate: DateTime
    type: UserExperienceType!
    status: ExperienceStatus!
    skills: [SkillHit!]
    companyId: String!
    company: CompanyHit
    employmentType: WorkEmploymentType!
    location: String
    locationType: WorkLocationType
    achievements: [String!]
  }

  type UserEducationExperience {
    id: ID!
    userId: String!
    title: String!
    description: String
    startDate: DateTime!
    endDate: DateTime
    type: UserExperienceType!
    status: ExperienceStatus!
    skills: [SkillHit!]
    schoolId: String!
    school: CompanyHit
    fieldOfStudy: String!
    grade: String
    extracurriculars: String
  }

  type UserProjectExperience {
    id: ID!
    userId: String!
    title: String!
    description: String
    startDate: DateTime!
    endDate: DateTime
    type: UserExperienceType!
    status: ExperienceStatus!
    skills: [SkillHit!]
  }

  type UserCertificationExperience {
    id: ID!
    userId: String!
    title: String!
    description: String
    startDate: DateTime!
    endDate: DateTime
    type: UserExperienceType!
    status: ExperienceStatus!
    skills: [SkillHit!]
  }

  type UserAwardExperience {
    id: ID!
    userId: String!
    title: String!
    description: String
    startDate: DateTime!
    endDate: DateTime
    type: UserExperienceType!
    status: ExperienceStatus!
    skills: [SkillHit!]
  }

  type UserPublicationExperience {
    id: ID!
    userId: String!
    title: String!
    description: String
    startDate: DateTime!
    endDate: DateTime
    type: UserExperienceType!
    status: ExperienceStatus!
    skills: [SkillHit!]
  }

  type UserCourseExperience {
    id: ID!
    userId: String!
    title: String!
    description: String
    startDate: DateTime!
    endDate: DateTime
    type: UserExperienceType!
    status: ExperienceStatus!
    skills: [SkillHit!]
  }

  type UserOpenSourceExperience {
    id: ID!
    userId: String!
    title: String!
    description: String
    startDate: DateTime!
    endDate: DateTime
    type: UserExperienceType!
    status: ExperienceStatus!
    skills: [SkillHit!]
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
    openSource: [UserOpenSourceExperience!]
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
      params: {
        status?: ExperienceStatus[];
      },
      ctx: AuthContext,
    ) => {
      const { userId } = ctx;
      const { status = [ExperienceStatus.Published] } = params;

      const entries = await queryReadReplica(ctx.con, ({ queryRunner }) =>
        queryRunner.manager
          .getRepository(UserExperience)
          .createQueryBuilder('experience')
          .where('experience.userId = :userId', { userId })
          .andWhere('experience.status IN (:...status)', {
            status,
          })
          .orderBy({
            'experience.endDate': 'DESC',
            'experience.startDate': 'DESC',
          })
          .getMany(),
      );

      return entries.reduce((acc, entry) => {
        const type = entry.type;
        if (!(type in acc)) {
          logger.warn(
            { entry, type, userId },
            `Unexpected experience type. Skipping entry.`,
          );
          return acc;
        }

        return { ...acc, [type]: [...acc[type], entry] };
      }, emptyExperienceTypesMap);
    },
  },
});
