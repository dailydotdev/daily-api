import { ChildEntity, Column, Index, JoinColumn, ManyToOne } from 'typeorm';
import { OpportunityType } from './types';
import { Opportunity } from './Opportunity';
import type { Organization } from '../Organization';

@ChildEntity(OpportunityType.Job)
export class OpportunityJob extends Opportunity {
  @Column({ type: 'text' })
  @Index('IDX_opportunity_organization_id')
  organizationId: string;

  @ManyToOne('Organization', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'organizationId',
    foreignKeyConstraintName: 'FK_opportunity_organization_id',
  })
  organization: Promise<Organization>;
}
