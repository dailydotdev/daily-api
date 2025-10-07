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
import { listAllProtoEnumValues } from '../../../common';
import type { DatasetLocation } from '../../dataset/DatasetLocation';

const defaultLocationTypes = listAllProtoEnumValues(LocationType);

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

  @Column()
  companyId: string;

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

  @Column()
  locationId: string;

  @ManyToOne('DatasetLocation', { lazy: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'locationId',
    foreignKeyConstraintName: 'FK_user_experience_dataset_location_locationId',
  })
  location: Promise<DatasetLocation>;

  @Column({
    type: 'integer',
    array: true,
    comment: 'LocationType from protobuf schema',
    default: defaultLocationTypes,
  })
  locationType: Array<LocationType> = defaultLocationTypes;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
