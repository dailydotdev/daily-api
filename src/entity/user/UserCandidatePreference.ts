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
  Location,
  LocationType,
} from '@dailydotdev/schema';
import type {
  salaryExpectationSchema,
  UserCandidateCV,
} from '../../common/schema/userCandidate';
import type z from 'zod';

export type SalaryExpectation = z.infer<typeof salaryExpectationSchema>;

@Entity()
export class UserCandidatePreference {
  @PrimaryColumn({
    type: 'text',
    primaryKeyConstraintName: 'PK_user_candidate_preference_user_id',
  })
  userId: string;

  @Column({
    type: 'integer',
    default: CandidateStatus.OPEN_TO_OFFERS,
    comment: 'CandidateStatus from protobuf schema',
  })
  @Index('IDX_user_candidate_preference_status')
  status: CandidateStatus = CandidateStatus.OPEN_TO_OFFERS;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'jsonb', default: '{}' })
  cv: UserCandidateCV;

  @Column({ type: 'jsonb', default: '{}' })
  cvParsed: unknown;

  @Column({ type: 'text', default: null })
  role: string;

  @Column({ type: 'float8', default: 0.5 })
  roleType: number;

  @Column({
    type: 'integer',
    array: true,
    default: [],
    comment: 'EmploymentType from protobuf schema',
  })
  employmentType: Array<EmploymentType>;

  @Column({
    type: 'jsonb',
    default: {},
    comment: 'Salary from protobuf schema',
  })
  salaryExpectation: SalaryExpectation;

  @Column({
    type: 'jsonb',
    default: [],
    comment: 'Location from protobuf schema',
  })
  location: Location[];

  @Column({
    type: 'integer',
    array: true,
    comment: 'LocationType from protobuf schema',
    default: [],
  })
  locationType: Array<LocationType>;

  @Column({
    type: 'integer',
    array: true,
    default: [],
    comment: 'CompanyStage from protobuf schema',
  })
  companyStage: Array<CompanyStage>;

  @Column({
    type: 'integer',
    array: true,
    default: [],
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
