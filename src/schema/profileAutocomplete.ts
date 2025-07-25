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

const autocompleteQueryMap = {
  [AutocompleteType.Skill]: { entity: UserSkill, propertyName: 'name' },
  [AutocompleteType.JobTitle]: {
    entity: UserWorkExperience,
    propertyName: 'title',
    where: { a: 0 },
  },
  [AutocompleteType.Company]: {
    entity: Company,
    propertyName: 'name',
    where: { verified: true, type: CompanyType.Business },
  },
  [AutocompleteType.CertificationName]: {
    entity: UserCertificationExperience,
    propertyName: 'name',
  },
  [AutocompleteType.CertificationIssuer]: {
    entity: UserCertificationExperience,
    propertyName: 'issuer',
  },
  [AutocompleteType.AwardName]: {
    entity: UserAwardExperience,
    propertyName: 'name',
  },
  [AutocompleteType.AwardIssuer]: {
    entity: UserAwardExperience,
    propertyName: 'issuer',
  },
  [AutocompleteType.PublicationPublisher]: {
    entity: UserPublicationExperience,
    propertyName: 'publisher',
  },
  [AutocompleteType.CourseInstitution]: {
    entity: UserCourseExperience,
    propertyName: 'institution',
  },
  [AutocompleteType.School]: {
    entity: Company,
    propertyName: 'name',
    where: { verified: true, type: CompanyType.School },
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
      if (
        !query ||
        query.length < 2 ||
        query.length > 100 ||
        !(type in autocompleteQueryMap)
      ) {
        return {
          query,
          hits: [],
        };
      }

      const { entity, propertyName } = autocompleteQueryMap[type];

      const hits = await ctx.con
        .getRepository(entity)
        .createQueryBuilder()
        .select(`id, ${propertyName}`)
        .where(`${propertyName} ILIKE :query`, { query: `%${query}%` })
        .andWhere(`status = :status`, { status: ExperienceStatus.Published })
        .andWhere(
          'where' in autocompleteQueryMap[type]
            ? (autocompleteQueryMap[type].where as Record<string, unknown>)
            : {},
        )
        .orderBy('propertyName', 'ASC')
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
