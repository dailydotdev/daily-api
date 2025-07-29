import { ChildEntity, Column, JoinColumn, ManyToOne } from 'typeorm';
import { UserExperience } from './UserExperience';
import { Company } from '../../Company';
import { WorkLocationType } from '../UserJobPreferences';
import {
  UserExperienceType,
  WorkEmploymentType,
  WorkVerificationStatus,
} from './types';

@ChildEntity(UserExperienceType.Work)
export class UserWorkExperience extends UserExperience {
  @Column()
  companyId: string;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'companyId' })
  company: Promise<Company>;

  @Column({
    type: 'enum',
    enum: WorkEmploymentType,
  })
  employmentType: WorkEmploymentType;

  // autocomplete, city level from specs, null for remote??
  @Column({ type: 'text', nullable: true })
  location: string;

  @Column({
    type: 'enum',
    enum: WorkLocationType,
    nullable: true,
  })
  locationType: WorkLocationType;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  achievements: string[];

  // do not send it to FE
  @Column({ type: 'text', nullable: true })
  verificationEmail: string;

  @Column({
    type: 'enum',
    enum: WorkVerificationStatus,
    nullable: true,
  })
  verificationStatus: WorkVerificationStatus;
}
