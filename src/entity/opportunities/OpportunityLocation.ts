import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { LocationType } from '@dailydotdev/schema';
import type { Opportunity } from './Opportunity';
import type { DatasetLocation } from '../dataset/DatasetLocation';

@Entity()
export class OpportunityLocation {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_opportunity_location_id',
  })
  id: string;

  @Column({ type: 'text' })
  @Index('IDX_opportunity_location_opportunityId')
  opportunityId: string;

  @ManyToOne('Opportunity', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'opportunityId',
    foreignKeyConstraintName:
      'FK_opportunity_location_opportunity_opportunityId',
  })
  opportunity: Promise<Opportunity>;

  @Column({ type: 'text' })
  @Index('IDX_opportunity_location_locationId')
  locationId: string;

  @ManyToOne('DatasetLocation', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'locationId',
    foreignKeyConstraintName:
      'FK_opportunity_location_dataset_location_locationId',
  })
  location: Promise<DatasetLocation>;

  @Column({
    type: 'integer',
    comment: 'LocationType from protobuf schema',
  })
  type: LocationType;
}
