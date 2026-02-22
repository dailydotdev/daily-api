import { ChildEntity, Column, Index, JoinColumn, ManyToOne } from 'typeorm';
import { OpportunityType } from '@dailydotdev/schema';
import { Opportunity } from './Opportunity';
import type { Organization } from '../Organization';

@ChildEntity(OpportunityType.JOB)
export class OpportunityJob extends Opportunity {
  @Column({ type: 'uuid', nullable: true })
  @Index('IDX_opportunity_organization_id')
  organizationId: string | null;

  @ManyToOne('Organization', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'organizationId',
    foreignKeyConstraintName: 'FK_opportunity_organization_id',
  })
  organization: Promise<Organization>;
}
