import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  TableInheritance,
  UpdateDateColumn,
} from 'typeorm';
import type { User } from '../User';
import { UserExperienceType } from './types';
import type { Company } from '../../Company';
import { LocationType } from '@dailydotdev/schema';
import type { DatasetLocation } from '../../dataset/DatasetLocation';

export type UserExperienceFlags = Partial<{
  import: string;
}>;

@Entity()
@TableInheritance({ column: { type: 'text', name: 'type' } })
export class UserExperience {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_user_experience_id',
  })
  id: string;

  @Column()
  @Index('IDX_user_experience_userId')
  userId: string;

  @ManyToOne('User', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({ foreignKeyConstraintName: 'FK_user_experience_user_userId' })
  user: Promise<User>;

  @Column({ type: 'text', nullable: true, default: null })
  customCompanyName: string | null;

  @Column({ nullable: true, default: null })
  companyId: string | null;

  @ManyToOne('Company', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({
    foreignKeyConstraintName: 'FK_user_experience_company_companyId',
  })
  company: Promise<Company>;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true })
  subtitle: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'timestamp' })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  endedAt: Date | null;

  @Column({ type: 'text', nullable: false })
  @Index('IDX_user_experience_type')
  type: UserExperienceType;

  @Column({ type: 'text', default: null })
  locationId: string | null;

  @Column({ type: 'jsonb', default: {} })
  customLocation: Partial<{
    city: string | null;
    subdivision: string | null;
    country: string | null;
  }>;

  @ManyToOne('DatasetLocation', { lazy: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'locationId',
    foreignKeyConstraintName: 'FK_user_experience_dataset_location_locationId',
  })
  location: Promise<DatasetLocation>;

  @Column({
    type: 'integer',
    comment: 'LocationType from protobuf schema',
    default: null,
  })
  locationType: LocationType | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @Column({ type: 'jsonb', default: {} })
  flags: UserExperienceFlags;
}
