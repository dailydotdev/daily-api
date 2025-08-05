import { UserExperience } from './UserExperience';
import { ChildEntity, Column } from 'typeorm';
import { UserExperienceType, baseUserExperienceSchema } from './types';
import { z } from 'zod';

@ChildEntity(UserExperienceType.Course)
export class UserCourseExperience extends UserExperience {
  @Column({ type: 'text', nullable: true })
  courseNumber: string;

  // autocomplete
  @Column({ type: 'text', nullable: true })
  institution: string;
}

// Zod schema for UserCourseExperience
export const userCourseExperienceSchema = baseUserExperienceSchema.extend({
  type: z.literal(UserExperienceType.Course),
  courseNumber: z.string().nullable().optional(),
  institution: z.string().nullable().optional(),
});
