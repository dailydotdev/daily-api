import { ObjectLiteral, Raw } from 'typeorm';
import { z } from 'zod';
import { IResolvers } from '@graphql-tools/utils';
import { UserSkill } from '../entity/user/UserSkill';
import { Company, CompanyType } from '../entity/Company';
import { UserCourseExperience } from '../entity/user/experiences/UserCourseExperience';
import { UserPublicationExperience } from '../entity/user/experiences/UserPublicationExperience';
import { UserAwardExperience } from '../entity/user/experiences/UserAwardExperience';
import { UserCertificationExperience } from '../entity/user/experiences/UserCertificationExperience';
import { UserWorkExperience } from '../entity/user/experiences/UserWorkExperience';
import { UserEducationExperience } from '../entity/user/experiences/UserEducationExperience';
import { BaseContext, Context } from '../Context';
import { traceResolvers } from './trace';
import { ExperienceStatus } from '../entity/user/experiences/types';
import { queryReadReplica } from '../common/queryReadReplica';
import { ValidationError } from 'apollo-server-errors';

export enum AutocompleteType {
  JobTitle = 'job_title',
  Company = 'company',
  Skill = 'skill',
  CertificationName = 'certification_name',
  CertificationIssuer = 'certification_issuer',
  AwardName = 'award_name',
  AwardIssuer = 'award_issuer',
  PublicationPublisher = 'publication_publisher',
  CourseInstitution = 'course_institution',
  School = 'school',
  FieldOfStudy = 'field_of_study',
}

type TypeToEntityMap = {
  [AutocompleteType.JobTitle]: UserWorkExperience;
  [AutocompleteType.Company]: Company;
  [AutocompleteType.Skill]: UserSkill;
  [AutocompleteType.CertificationName]: UserCertificationExperience;
  [AutocompleteType.CertificationIssuer]: Company;
  [AutocompleteType.AwardName]: UserAwardExperience;
  [AutocompleteType.AwardIssuer]: UserAwardExperience;
  [AutocompleteType.PublicationPublisher]: UserPublicationExperience;
  [AutocompleteType.CourseInstitution]: UserCourseExperience;
  [AutocompleteType.School]: Company;
  [AutocompleteType.FieldOfStudy]: UserEducationExperience;
};

type AutocompleteQuery<T = ObjectLiteral> = {
  entity: {
    new (): T;
  };
  propertyName: keyof T;
  where?: Partial<Record<keyof T, unknown>>;
  select?: (keyof T)[];
};

type AutoCompleteQueryMap = {
  [key in AutocompleteType]: AutocompleteQuery<TypeToEntityMap[key]>;
};

const autocompleteQueryMap: AutoCompleteQueryMap = {
  [AutocompleteType.Skill]: {
    entity: UserSkill,
    propertyName: 'name',
    select: ['slug', 'name'],
  },
  [AutocompleteType.JobTitle]: {
    entity: UserWorkExperience,
    propertyName: 'title',
    where: { status: ExperienceStatus.Published },
  },
  [AutocompleteType.Company]: {
    entity: Company,
    propertyName: 'name',
    where: { type: CompanyType.Business },
    select: ['id', 'name', 'image'],
  },
  [AutocompleteType.CertificationName]: {
    entity: UserCertificationExperience,
    propertyName: 'title',
    where: { status: ExperienceStatus.Published },
  },
  [AutocompleteType.CertificationIssuer]: {
    entity: Company,
    propertyName: 'name',
    select: ['id', 'name', 'image'],
  },
  [AutocompleteType.AwardName]: {
    entity: UserAwardExperience,
    propertyName: 'title',
    where: { status: ExperienceStatus.Published },
  },
  [AutocompleteType.AwardIssuer]: {
    entity: UserAwardExperience,
    propertyName: 'issuer',
    where: { status: ExperienceStatus.Published },
  },
  [AutocompleteType.PublicationPublisher]: {
    entity: UserPublicationExperience,
    propertyName: 'publisher',
    where: { status: ExperienceStatus.Published },
  },
  [AutocompleteType.CourseInstitution]: {
    entity: UserCourseExperience,
    propertyName: 'institution',
    where: { status: ExperienceStatus.Published },
  },
  [AutocompleteType.School]: {
    entity: Company,
    propertyName: 'name',
    where: { type: CompanyType.School },
    select: ['id', 'name', 'image'],
  },
  [AutocompleteType.FieldOfStudy]: {
    entity: UserEducationExperience,
    propertyName: 'fieldOfStudy',
  },
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

  union AutocompleteHit = ExperienceHit | CompanyHit | SkillHit

  type AutocompleteResult {
    query: String!
    limit: Int
    hits: [AutocompleteHit!]!
  }

  extend type Query {
    """
    Get autocomplete suggestions for various fields like job titles, companies, skills, etc.
    """
    profileAutocomplete(
      type: String!
      query: String!
      limit: Int
    ): AutocompleteResult!
  }
`;

export const DEFAULT_AUTOCOMPLETE_LIMIT = 10;

const profileAutocompleteSchema = z.object({
  type: z.nativeEnum(AutocompleteType, {
    errorMap: () => ({ message: 'Invalid autocomplete type' }),
  }),
  query: z
    .string()
    .min(2, 'Query must be at least 2 characters long')
    .max(100, 'Query must not exceed 100 characters'),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .default(DEFAULT_AUTOCOMPLETE_LIMIT),
});

// Type inference from the schema
type ProfileAutocompleteInput = z.infer<typeof profileAutocompleteSchema>;

export const resolvers: IResolvers<unknown, BaseContext> = traceResolvers<
  unknown,
  BaseContext
>({
  Query: {
    profileAutocomplete: async (
      _,
      params: ProfileAutocompleteInput,
      ctx: Context,
    ) => {
      const validation = profileAutocompleteSchema.safeParse(params);

      if (!validation.success) {
        if (validation.error.formErrors.fieldErrors.query) {
          return {
            query: params.query ?? '',
            limit: params.limit ?? DEFAULT_AUTOCOMPLETE_LIMIT,
            hits: [],
          };
        }

        throw new ValidationError(validation.error.message);
      }

      const { type, query, limit }: ProfileAutocompleteInput = validation.data;
      const {
        entity,
        propertyName,
        where = {},
        select,
      } = autocompleteQueryMap[type];

      const typeNameByEntity = {
        [UserWorkExperience.name]: 'ExperienceHit',
        [Company.name]: 'CompanyHit',
        [UserSkill.name]: 'SkillHit',
        [UserCertificationExperience.name]: 'ExperienceHit',
        [UserAwardExperience.name]: 'ExperienceHit',
        [UserPublicationExperience.name]: 'ExperienceHit',
        [UserCourseExperience.name]: 'ExperienceHit',
        [UserEducationExperience.name]: 'ExperienceHit',
      } as const;

      const hits = await queryReadReplica(ctx.con, ({ queryRunner }) =>
        queryRunner.manager
          .getRepository(entity)
          .createQueryBuilder('entity')
          .select(select ?? ['id', propertyName])
          .where({
            [propertyName]: Raw(
              (alias) => `LOWER(${alias}) LIKE LOWER(:query)`,
              { query: `%${query}%` },
            ),
            // extending where condition using the autocompleteQueryMap
            ...where,
          })
          // sort by selected property name
          .orderBy(`entity.${propertyName}`, 'ASC')
          .limit(limit)
          .getRawMany(),
      );

      return {
        query,
        limit,
        hits: hits.map((hit) => ({
          __typename: typeNameByEntity[entity.name],
          ...hit,
        })),
      };
    },
  },
});
