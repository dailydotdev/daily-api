import { UserExperience } from './UserExperience';
import { ChildEntity, Column, JoinColumn, ManyToOne } from 'typeorm';
import type { Company } from '../../Company';
import { UserExperienceType } from './types';

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
