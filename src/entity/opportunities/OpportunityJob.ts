import { ChildEntity, Column, Index, JoinColumn, ManyToOne } from 'typeorm';
import { OpportunityType, type Location } from '@dailydotdev/schema';
import { Opportunity } from './Opportunity';
import type { Organization } from '../Organization';

@ChildEntity(OpportunityType.JOB)
export class OpportunityJob extends Opportunity {
  @Column({ type: 'text', nullable: true })
  @Index('IDX_opportunity_organization_id')
  organizationId: string | null;

  @Column({
    type: 'jsonb',
    default: [],
    comment: 'Location from protobuf schema',
  })
  location: Location[];

  @ManyToOne('Organization', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'organizationId',
    foreignKeyConstraintName: 'FK_opportunity_organization_id',
  })
  organization: Promise<Organization>;
}
