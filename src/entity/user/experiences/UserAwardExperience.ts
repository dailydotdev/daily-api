import { ChildEntity, Column, JoinColumn, OneToOne } from 'typeorm';
import { UserExperienceType, baseUserExperienceSchema } from './types';
import { UserExperience } from './UserExperience';
import { z } from 'zod';

@ChildEntity(UserExperienceType.Award)
export class UserAwardExperience extends UserExperience {
  // autocomplete
  @Column({ type: 'text', nullable: true })
  issuer: string;

  @Column()
  workingExperienceId: string | null;

  @OneToOne('UserWorkExperience')
  @JoinColumn({
    name: 'workingExperienceId',
    referencedColumnName: 'id',
  })
  workingExperience: UserExperience | null;

  @Column()
  educationExperienceId: string | null;

  @OneToOne('UserEducationExperience')
  @JoinColumn({
    name: 'educationExperienceId',
    referencedColumnName: 'id',
  })
  educationExperience: UserExperience | null;
}

// Zod schema for UserAwardExperience
export const userAwardExperienceSchema = baseUserExperienceSchema.extend({
  issuer: z.string().nullable().optional(),
  workingExperienceId: z.string().uuid().nullable().optional(),
  educationExperienceId: z.string().uuid().nullable().optional(),
});
