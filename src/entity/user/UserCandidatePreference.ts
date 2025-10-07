import type z from 'zod';
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
import {
  CompanySize,
  CompanyStage,
  EmploymentType,
  LocationType,
} from '@dailydotdev/schema';
import type { Location } from '@dailydotdev/schema';
import type {
  GCSBlob,
  salaryExpectationSchema,
  UserCandidateCV,
} from '../../common/schema/userCandidate';
import { listAllProtoEnumValues } from '../../common';

export type SalaryExpectation = z.infer<typeof salaryExpectationSchema>;

const defaultEmploymentTypes = listAllProtoEnumValues(EmploymentType);
const defaultLocationTypes = listAllProtoEnumValues(LocationType);
const defaultCompanyStages = listAllProtoEnumValues(CompanyStage);
const defaultCompanySizes = listAllProtoEnumValues(CompanySize);

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
  updatedAt: Date = new Date();

  @Column({ type: 'jsonb', default: {} })
  cv: UserCandidateCV = {};

  @Column({ type: 'jsonb', default: {} })
  cvParsed: Record<string, unknown> = {};

  @Column({ type: 'jsonb', default: {} })
  employmentAgreement: GCSBlob = {};

  @Column({ type: 'text', default: null })
  role?: string;

  @Column({ type: 'float8', default: 0.5 })
  roleType: number = 0.5;

  @Column({
    type: 'integer',
    array: true,
    comment: 'EmploymentType from protobuf schema',
    default: defaultEmploymentTypes,
  })
  employmentType: Array<EmploymentType> = defaultEmploymentTypes;

  @Column({
    type: 'jsonb',
    default: {},
    comment: 'Salary from protobuf schema',
  })
  salaryExpectation: SalaryExpectation = {};

  @Column({
    type: 'jsonb',
    default: [],
    comment: 'Location from protobuf schema',
  })
  location: Array<Location> = [];

  @Column({
    type: 'integer',
    array: true,
    comment: 'LocationType from protobuf schema',
    default: defaultLocationTypes,
  })
  locationType: Array<LocationType> = defaultLocationTypes;

  @Column({
    type: 'integer',
    array: true,
    comment: 'CompanyStage from protobuf schema',
    default: defaultCompanyStages,
  })
  companyStage: Array<CompanyStage> = defaultCompanyStages;

  @Column({
    type: 'integer',
    array: true,
    comment: 'CompanySize from protobuf schema',
    default: defaultCompanySizes,
  })
  companySize: Array<CompanySize> = defaultCompanySizes;

  @Column({
    type: 'boolean',
    default: false,
  })
  customKeywords: boolean = false;

  @OneToOne('User', (user: User) => user.candidatePreference, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_user_candidate_preference_user_id',
  })
  user: Promise<User>;

  @Column({ type: 'text', default: null })
  cvParsedMarkdown: string | null;
}
