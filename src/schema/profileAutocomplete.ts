import { UserSkill } from '../entity/user/UserSkill';
import { Company, CompanyType } from '../entity/Company';
import { UserCourseExperience } from '../entity/user/experiences/UserCourseExperience';
import { UserPublicationExperience } from '../entity/user/experiences/UserPublicationExperience';
import { UserAwardExperience } from '../entity/user/experiences/UserAwardExperience';
import { UserCertificationExperience } from '../entity/user/experiences/UserCertificationExperience';
import { UserWorkExperience } from '../entity/user/experiences/UserWorkExperience';
import { UserEducationExperience } from '../entity/user/experiences/UserEducationExperience';
import { IResolvers } from '@graphql-tools/utils';
import { BaseContext, Context } from '../Context';
import { traceResolvers } from './trace';
import { ExperienceStatus } from '../entity/user/experiences/types';
import { ValidationError } from 'apollo-server-errors';
import { ObjectLiteral } from 'typeorm';

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
};

type AutoCompleteQueryMap = {
  [key in AutocompleteType]: AutocompleteQuery<TypeToEntityMap[key]>;
};

const autocompleteQueryMap: AutoCompleteQueryMap = {
  [AutocompleteType.Skill]: {
    entity: UserSkill,
    propertyName: 'name',
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
  },
  [AutocompleteType.CertificationName]: {
    entity: UserCertificationExperience,
    propertyName: 'title',
    where: { status: ExperienceStatus.Published },
  },
  [AutocompleteType.CertificationIssuer]: {
    entity: Company,
    propertyName: 'name',
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
  },
  [AutocompleteType.FieldOfStudy]: {
    entity: UserEducationExperience,
    propertyName: 'fieldOfStudy',
  },
} as const;

export const resolvers: IResolvers<unknown, BaseContext> = traceResolvers<
  unknown,
  BaseContext
>({
  Query: {
    autocomplete: async (
      _,
      {
        type,
        query,
        limit,
      }: { type: AutocompleteType; query: string; limit?: number },
      ctx: Context,
    ) => {
      if (!query || query.length < 2 || query.length > 100) {
        return {
          query,
          hits: [],
        };
      }

      if (!(type in autocompleteQueryMap)) {
        throw new ValidationError(`Invalid autocomplete type: ${type}`);
      }

      const { entity, propertyName, where = {} } = autocompleteQueryMap[type];

      const hits = await ctx.con
        .getRepository(entity)
        .createQueryBuilder()
        .select(`id, ${propertyName}`)
        .where(`${propertyName} ILIKE :query`, { query: `%${query}%` })
        // extending where condition using the autocompleteQueryMap
        .andWhere(where)
        // sort by selected property name
        .orderBy(propertyName, 'ASC')
        .limit(limit)
        .getRawMany();

      return {
        query,
        limit,
        hits,
      };
    },
  },
});
