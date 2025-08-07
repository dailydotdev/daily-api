import { z } from 'zod';
import { ValidationError } from 'apollo-server-errors';
import { CompanyType } from '../entity/Company';
import {
  ExperienceStatus,
  UserExperienceType,
  WorkVerificationStatus,
} from '../entity/user/experiences/types';
import type { UserWorkExperience } from '../entity/user/experiences/UserWorkExperience';
import type { UserProjectExperience } from '../entity/user/experiences/UserProjectExperience';
import type { UserCourseExperience } from '../entity/user/experiences/UserCourseExperience';
import type { UserPublicationExperience } from '../entity/user/experiences/UserPublicationExperience';
import type { UserAwardExperience } from '../entity/user/experiences/UserAwardExperience';
import type { UserCertificationExperience } from '../entity/user/experiences/UserCertificationExperience';
import type { UserEducationExperience } from '../entity/user/experiences/UserEducationExperience';
import {
  userAwardExperienceSchema,
  userCertificationExperienceSchema,
  userCourseExperienceSchema,
  userEducationExperienceSchema,
  userProjectExperienceSchema,
  userPublicationExperienceSchema,
  userWorkExperienceSchema,
} from './schema/userExperience';
import { DataSource } from 'typeorm';
import { UserCompany } from '../entity';
import { queryReadReplica } from './queryReadReplica';

// Autocomplete
export enum ExperienceAutocompleteType {
  JobTitle = 'job_title',
  CertificationName = 'certification_name',
  AwardName = 'award_name',
  AwardIssuer = 'award_issuer',
  PublicationPublisher = 'publication_publisher',
  CourseInstitution = 'course_institution',
  FieldOfStudy = 'field_of_study',
}

export type AutocompleteInput = z.infer<typeof autocompleteBaseValidation>;
export type ExperienceAutocompleteInput = z.infer<
  typeof autocomplete.validation.experience
>;
export type CompanyAutocompleteInput = z.infer<
  typeof autocomplete.validation.company
>;

const experiencePropertyByType: Record<ExperienceAutocompleteType, string> = {
  [ExperienceAutocompleteType.JobTitle]: 'title',
  [ExperienceAutocompleteType.CertificationName]: 'title',
  [ExperienceAutocompleteType.AwardName]: 'title',
  [ExperienceAutocompleteType.AwardIssuer]: 'issuer',
  [ExperienceAutocompleteType.PublicationPublisher]: 'publisher',
  [ExperienceAutocompleteType.CourseInstitution]: 'institution',
  [ExperienceAutocompleteType.FieldOfStudy]: 'fieldOfStudy',
} as const;

const queryValidation = z.string().min(2).max(100);

export const DEFAULT_AUTOCOMPLETE_LIMIT = 10;
const limitValidation = z
  .number()
  .int()
  .min(1)
  .max(100)
  .positive()
  .optional()
  .default(DEFAULT_AUTOCOMPLETE_LIMIT);

// Schema for experienceHitAutocomplete
const autocompleteBaseValidation = z.object({
  query: queryValidation,
  limit: limitValidation,
});

export const autocomplete = {
  validation: {
    base: autocompleteBaseValidation,
    experience: autocompleteBaseValidation.extend({
      type: z.nativeEnum(ExperienceAutocompleteType),
    }),
    company: autocompleteBaseValidation.extend({
      type: z.nativeEnum(CompanyType).optional().default(CompanyType.Business),
    }),
  },
  propertyByType: experiencePropertyByType,
  handleValidationError: <T extends AutocompleteInput>(
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
  },
};

// Experiences
export const EXPERIENCES_QUERY_LIMIT = 100;
export const experiences = {
  validation: {
    queryAll: z.object({
      status: z
        .array(z.nativeEnum(ExperienceStatus))
        .optional()
        .default([ExperienceStatus.Published]),
    }),
    remove: z.object({
      id: z.string().uuid(),
    }),
    update: z.discriminatedUnion('type', [
      userAwardExperienceSchema
        .omit({ id: true, userId: true })
        .partial()
        .required({ type: true }),
      userCertificationExperienceSchema
        .omit({
          id: true,
          userId: true,
        })
        .partial()
        .required({ type: true }),
      userCourseExperienceSchema
        .omit({ id: true, userId: true })
        .partial()
        .required({ type: true }),
      userEducationExperienceSchema
        .omit({
          id: true,
          userId: true,
        })
        .partial()
        .required({ type: true }),
      userProjectExperienceSchema
        .omit({ id: true, userId: true })
        .partial()
        .required({ type: true }),
      userPublicationExperienceSchema
        .omit({
          id: true,
          userId: true,
        })
        .partial()
        .required({ type: true }),
      userWorkExperienceSchema
        .omit({
          id: true,
          userId: true,
          // cannot verify using update
          verificationEmail: true,
          verificationStatus: true,
        })
        .partial()
        .required({ type: true }),
    ]),
  },
};

export type ExperienceQueryParams = z.infer<
  typeof experiences.validation.queryAll
>;
export type ExperienceRemoveParams = z.infer<
  typeof experiences.validation.remove
>;
export type ExperienceUpdateParams = z.infer<
  typeof experiences.validation.update
>;

export const getEmptyExperienceTypesMap = () => ({
  [UserExperienceType.Award]: [] as Array<UserAwardExperience>,
  [UserExperienceType.Certification]: [] as Array<UserCertificationExperience>,
  [UserExperienceType.Course]: [] as Array<UserCourseExperience>,
  [UserExperienceType.Education]: [] as Array<UserEducationExperience>,
  [UserExperienceType.Project]: [] as Array<UserProjectExperience>,
  [UserExperienceType.Publication]: [] as Array<UserPublicationExperience>,
  [UserExperienceType.Work]: [] as Array<UserWorkExperience>,
});

export const experienceTypeToRepositoryMap: Record<UserExperienceType, string> =
  {
    [UserExperienceType.Work]: 'UserWorkExperience',
    [UserExperienceType.Education]: 'UserEducationExperience',
    [UserExperienceType.Project]: 'UserProjectExperience',
    [UserExperienceType.Certification]: 'UserCertificationExperience',
    [UserExperienceType.Award]: 'UserAwardExperience',
    [UserExperienceType.Publication]: 'UserPublicationExperience',
    [UserExperienceType.Course]: 'UserCourseExperience',
  };

// Work Email Verification
export const completeVerificationForExperienceByUserCompany = async (
  con: DataSource,
  { companyId, userId, email: verificationEmail }: UserCompany,
): Promise<boolean> => {
  if (!companyId) return false;

  const experience = await queryReadReplica(con, ({ queryRunner }) =>
    queryRunner.manager
      .getRepository<UserWorkExperience>('UserWorkExperience')
      .findOneBy({
        userId,
        companyId,
      }),
  );

  if (
    experience &&
    experience.verificationStatus !== WorkVerificationStatus.Verified
  ) {
    await con.getRepository<UserWorkExperience>('UserWorkExperience').update(
      { userId, companyId },
      {
        verificationEmail,
        verificationStatus: WorkVerificationStatus.Verified,
      },
    );

    return true;
  }

  return false;
};
