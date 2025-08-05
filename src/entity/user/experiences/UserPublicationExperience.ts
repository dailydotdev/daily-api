import { UserExperienceType, baseUserExperienceSchema } from './types';
import { ChildEntity, Column, JoinColumn, OneToOne } from 'typeorm';
import { UserExperience } from './UserExperience';
import { z } from 'zod';

@ChildEntity(UserExperienceType.Publication)
export class UserPublicationExperience extends UserExperience {
  // autocomplete
  @Column({ type: 'text', nullable: true })
  publisher: string;

  // must be valid URL
  @Column({ type: 'text', nullable: true })
  url: string;

  // user ids
  @Column({ type: 'text', array: true, default: [] })
  contributors: string[];

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

// Zod schema for UserPublicationExperience
export const userPublicationExperienceSchema = baseUserExperienceSchema.extend({
  publisher: z.string().nullable().optional(),
  url: z.string().url('URL must be a valid URL').nullable().optional(),
  contributors: z.array(z.string()).default([]),
  workingExperienceId: z.string().uuid().nullable().optional(),
  educationExperienceId: z.string().uuid().nullable().optional(),
});
