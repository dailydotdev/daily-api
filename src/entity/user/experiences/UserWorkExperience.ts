import { ChildEntity, Column, JoinColumn, ManyToOne } from 'typeorm';
import { UserExperience } from './UserExperience';
import type { Company } from '../../Company';
import {
  UserExperienceType,
  WorkEmploymentType,
  WorkVerificationStatus,
  type WorkLocationType,
} from './types';

@ChildEntity(UserExperienceType.Work)
export class UserWorkExperience extends UserExperience {
  @Column()
  companyId: string;

  @ManyToOne('Company')
  @JoinColumn({ name: 'companyId' })
  company: Promise<Company>;

  @Column({
    type: 'text',
  })
  employmentType: WorkEmploymentType;

  @Column({ type: 'text', nullable: true })
  location: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  locationType: WorkLocationType;

  @Column({ type: 'text', array: true, default: [] })
  achievements: string[];

  // todo: never send this field to FE while implementing MI-958
  @Column({ type: 'text', nullable: true })
  verificationEmail: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  verificationStatus: WorkVerificationStatus;
}
