import { ChildEntity, Column, JoinColumn, ManyToOne } from 'typeorm';
import { UserExperience } from './UserExperience';
import type { Company } from '../../Company';
import { UserExperienceType, baseUserExperienceSchema } from './types';
import { z } from 'zod';

@ChildEntity(UserExperienceType.Education)
export class UserEducationExperience extends UserExperience {
  @Column()
  schoolId: string;

  @ManyToOne('Company')
  @JoinColumn({ name: 'schoolId' })
  school: Promise<Company>;

  @Column({ type: 'text' })
  fieldOfStudy: string;

  // todo: Need to define if this is an ENUM using some kind of convention
  @Column({ type: 'text', nullable: true })
  grade: string;

  @Column({ type: 'text', nullable: true })
  extracurriculars: string;
}

// Zod schema for UserEducationExperience
export const userEducationExperienceSchema = baseUserExperienceSchema.extend({
  type: z.literal(UserExperienceType.Education),
  schoolId: z.string().uuid(),
  fieldOfStudy: z.string().min(1, 'Field of study is required'),
  grade: z.string().nullable().optional(),
  extracurriculars: z.string().nullable().optional(),
});
