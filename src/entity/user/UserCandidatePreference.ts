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

export enum SalaryDuration {
  Monthly = 'monthly',
  Annualy = 'annualy',
}

export const userCandidateCVSchema = z.object({
  bucket: z.string(),
  blob: z.string(),
  lastModified: z.date(),
});

export const salaryExpectationSchema = z.object({
  min: z.number().min(0).nullable(),
  max: z.number().min(0).nullable(),
  currency: z.string().default('USD'),
  period: z.enum(SalaryDuration, {
    error: 'Invalid salary duration',
  }),
});

export const locationTypeSchema = z.object({
  remote: z.boolean(),
  office: z.boolean(),
  onSite: z.boolean(),
});

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

  @Column({ type: 'text', default: null })
  locationCountry: string;

  @Column({ type: 'text', default: null })
  locationCity: string;

  @Column({ type: 'text', default: null })
  locationContinent: string;

  @Column({ type: 'text', default: null })
  locationSubdivision: string;

  @Column({ type: 'float8', default: null })
  locationLatitude: number;

  @Column({ type: 'float8', default: null })
  locationLongitude: number;

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
