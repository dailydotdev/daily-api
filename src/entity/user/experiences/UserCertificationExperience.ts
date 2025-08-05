import { UserExperience } from './UserExperience';
import { ChildEntity, Column, JoinColumn, ManyToOne } from 'typeorm';
import type { Company } from '../../Company';
import { UserExperienceType, baseUserExperienceSchema } from './types';
import { z } from 'zod';

@ChildEntity(UserExperienceType.Certification)
export class UserCertificationExperience extends UserExperience {
  @Column({ type: 'text', nullable: true })
  courseNumber: string;

  @Column()
  companyId: string;

  @ManyToOne('Company')
  @JoinColumn({ name: 'companyId' })
  company: Promise<Company>;

  @Column({ type: 'text', nullable: true })
  credentialId: string;

  // only valid URLs or null
  @Column({ type: 'text', nullable: true })
  credentialUrl: string;
}

// Zod schema for UserCertificationExperience
export const userCertificationExperienceSchema =
  baseUserExperienceSchema.extend({
    type: z.literal(UserExperienceType.Certification),
    courseNumber: z.string().nullable().optional(),
    companyId: z.string().uuid(),
    credentialId: z.string().nullable().optional(),
    credentialUrl: z
      .string()
      .url('Credential URL must be a valid URL')
      .nullable()
      .optional(),
  });
