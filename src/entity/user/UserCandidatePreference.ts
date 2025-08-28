import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { User } from './User';
import z from 'zod';
import type { CompanySize, CompanyStage } from '../Organization';
import type {
  locationSchema,
  locationTypeSchema,
  salaryExpectationSchema,
  userCandidateCVSchema,
} from '../../common/schema/userCandidate';

export enum CandidateStatus {
  Disabled = 'disabled',
  ActivelyLooking = 'actively_looking',
  OpenToOffers = 'open_to_offers',
}

export enum EmploymentType {
  FullTime = 'full_time',
  PartTime = 'part_time',
  Contract = 'contract',
  Internship = 'internship',
}

@Entity()
export class UserCandidatePreference {
  @PrimaryColumn({
    type: 'text',
    primaryKeyConstraintName: 'PK_user_candidate_preference_user_id',
  })
  userId: string;

  @Column({ type: 'text', default: CandidateStatus.Disabled })
  status: CandidateStatus = CandidateStatus.Disabled;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'jsonb', default: '{}' })
  cv: z.infer<typeof userCandidateCVSchema>;

  @Column({ type: 'jsonb', default: '{}' })
  cvParsed: unknown;

  @Column({ type: 'text', default: null })
  role: string;

  @Column({ type: 'float8', default: 0.5 })
  roleType: number;

  @Column({ type: 'text', array: true, default: null })
  employmentType: EmploymentType[];

  @Column({ type: 'jsonb', default: '{}' })
  salaryExpectation: z.infer<typeof salaryExpectationSchema>;

  @Column({ type: 'jsonb', default: '[]' })
  location: z.infer<typeof locationSchema>[];

  @Column({ type: 'jsonb', default: '{}' })
  locationType: z.infer<typeof locationTypeSchema>;

  @Column({ type: 'text', array: true, default: null })
  companyStage: CompanyStage[];

  @Column({ type: 'text', array: true, default: null })
  companySize: CompanySize[];

  @OneToOne('User', (user: User) => user.candidatePreference, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_user_candidate_preference_user_id',
  })
  user: Promise<User>;
}
