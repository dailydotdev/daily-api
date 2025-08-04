// Common query and limit validation
import { z } from 'zod';
import { CompanyType } from '../entity/Company';
import { ValidationError } from 'apollo-server-errors';
import { ExperienceStatus, UserExperienceType } from '../entity/user/experiences/types';
import { UserExperience } from '../entity/user/experiences/UserExperience';

// Autocomplete

export const DEFAULT_AUTOCOMPLETE_LIMIT = 10;

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

const queryValidation = z
  .string()
  .min(2, 'Query must be at least 2 characters long')
  .max(100, 'Query must not exceed 100 characters');

const limitValidation = z
  .number()
  .int()
  .min(1, 'Limit must be at least 1')
  .max(100, 'Limit must not exceed 20')
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

export const experiencesQueryValidation = z.object({
  status: z
    .array(z.nativeEnum(ExperienceStatus))
    .optional()
    .default([ExperienceStatus.Published]),
});

export const emptyExperienceTypesMap = Object.fromEntries(
  Object.values(UserExperienceType).map((type) => [
    type,
    [] as Array<UserExperience>,
  ]),
) as Record<UserExperienceType, Array<UserExperience>>;
