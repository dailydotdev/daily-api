import z from 'zod';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { User } from './User';
import { CandidateStatus } from '@dailydotdev/schema';
import type {
  CompanySize,
  CompanyStage,
  EmploymentType,
} from '@dailydotdev/schema';
import type {
  locationSchema,
  locationTypeSchema,
  salaryExpectationSchema,
  userCandidateCVSchema,
} from '../../common/schema/userCandidate';

@Entity()
export class UserCandidatePreference {
  @PrimaryColumn({
    type: 'text',
    primaryKeyConstraintName: 'PK_user_candidate_preference_user_id',
  })
  userId: string;

  @Column({
    type: 'integer',
    default: CandidateStatus.DISABLED,
    comment: 'CandidateStatus from protobuf schema',
  })
  @Index('IDX_user_candidate_preference_status')
  status: CandidateStatus = CandidateStatus.DISABLED;

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

  @Column({
    type: 'integer',
    array: true,
    default: null,
    comment: 'EmploymentType from protobuf schema',
  })
  employmentType: Array<EmploymentType>;

  @Column({ type: 'jsonb', default: '{}' })
  salaryExpectation: z.infer<typeof salaryExpectationSchema>;

  @Column({ type: 'jsonb', default: '[]' })
  location: z.infer<typeof locationSchema>[];

  @Column({ type: 'jsonb', default: '{}' })
  locationType: z.infer<typeof locationTypeSchema>;

  @Column({
    type: 'integer',
    array: true,
    default: null,
    comment: 'CompanyStage from protobuf schema',
  })
  companyStage: Array<CompanyStage>;

  @Column({
    type: 'integer',
    array: true,
    default: null,
    comment: 'CompanySize from protobuf schema',
  })
  companySize: Array<CompanySize>;

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
