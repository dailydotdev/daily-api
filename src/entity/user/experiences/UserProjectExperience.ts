import { UserExperience } from './UserExperience';
import { ChildEntity, Column, JoinColumn, OneToOne } from 'typeorm';
import {
  ProjectLink,
  UserExperienceType,
  baseUserExperienceSchema,
  projectLinkSchema,
} from './types';
import { z } from 'zod';

@ChildEntity(UserExperienceType.Project)
export class UserProjectExperience extends UserExperience {
  @Column({ type: 'jsonb', default: [] })
  links: Array<ProjectLink>;

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

// Zod schema for UserProjectExperience
export const userProjectExperienceSchema = baseUserExperienceSchema.extend({
  links: z.array(projectLinkSchema).default([]),
  contributors: z.array(z.string()).default([]),
  workingExperienceId: z.string().uuid().nullable().optional(),
  educationExperienceId: z.string().uuid().nullable().optional(),
});
