import { Raw } from 'typeorm';
import { z } from 'zod';
import { IResolvers } from '@graphql-tools/utils';
import { UserSkill } from '../entity/user/UserSkill';
import { Company, CompanyType } from '../entity/Company';
import { BaseContext, Context } from '../Context';
import { traceResolvers } from './trace';
import { ExperienceStatus } from '../entity/user/experiences/types';
import { queryReadReplica } from '../common/queryReadReplica';
import { ValidationError } from 'apollo-server-errors';
import { UserExperience } from '../entity/user/experiences/UserExperience';

export enum ExperienceAutocompleteType {
  JobTitle = 'job_title',
  CertificationName = 'certification_name',
  AwardName = 'award_name',
  AwardIssuer = 'award_issuer',
  PublicationPublisher = 'publication_publisher',
  CourseInstitution = 'course_institution',
  FieldOfStudy = 'field_of_study',
}

const experiencePropertyByType: Record<ExperienceAutocompleteType, string> = {
  [ExperienceAutocompleteType.JobTitle]: 'title',
  [ExperienceAutocompleteType.CertificationName]: 'title',
  [ExperienceAutocompleteType.AwardName]: 'title',
  [ExperienceAutocompleteType.AwardIssuer]: 'issuer',
  [ExperienceAutocompleteType.PublicationPublisher]: 'publisher',
  [ExperienceAutocompleteType.CourseInstitution]: 'institution',
  [ExperienceAutocompleteType.FieldOfStudy]: 'fieldOfStudy',
} as const;

export const typeDefs = /* GraphQL */ `
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
  }
`;

export const DEFAULT_AUTOCOMPLETE_LIMIT = 10;

// Common query and limit validation
const queryValidation = z
  .string()
  .min(2, 'Query must be at least 2 characters long')
  .max(100, 'Query must not exceed 100 characters');

const limitValidation = z
  .number()
  .int()
  .positive()
  .optional()
  .default(DEFAULT_AUTOCOMPLETE_LIMIT);

// Schema for experienceHitAutocomplete
const baseValidation = z.object({
  query: queryValidation,
  limit: limitValidation,
});

const experienceValidation = baseValidation.extend({
  type: z.nativeEnum(ExperienceAutocompleteType),
});

const companyValidation = baseValidation.extend({
  type: z.nativeEnum(CompanyType).optional().default(CompanyType.Business),
});

type AutocompleteInput = z.infer<typeof baseValidation>;
type ExperienceAutocompleteInput = z.infer<typeof experienceValidation>;
type CompanyAutocompleteInput = z.infer<typeof companyValidation>;

// Helper function to handle validation errors
const handleValidationError = <T extends AutocompleteInput>(
  error: z.SafeParseError<T>['error'],
  params: T,
) => {
  if ('query' in error.formErrors.fieldErrors) {
    return {
      query: params.query ?? '',
      limit: params.limit ?? DEFAULT_AUTOCOMPLETE_LIMIT,
      hits: [],
    };
  }

  throw new ValidationError(error.message);
};

export const resolvers: IResolvers<unknown, BaseContext> = traceResolvers<
  unknown,
  BaseContext
>({
  Query: {
    experienceAutocomplete: async (
      _,
      params: ExperienceAutocompleteInput,
      ctx: Context,
    ) => {
      const {
        data,
        success: passedValidation,
        error,
      } = experienceValidation.safeParse(params);

      if (!passedValidation) {
        return handleValidationError(error, params);
      }

      const { type, query, limit }: ExperienceAutocompleteInput = data;
      const propertyName = experiencePropertyByType[
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
      ctx: Context,
    ) => {
      const {
        data,
        success: passedValidation,
        error,
      } = companyValidation.safeParse(params);

      if (!passedValidation) {
        return handleValidationError(error, params);
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
    skillAutocomplete: async (_, params: AutocompleteInput, ctx: Context) => {
      const {
        data,
        success: passedValidation,
        error,
      } = baseValidation.safeParse(params);

      if (!passedValidation) {
        return handleValidationError(error, params);
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
  },
});
