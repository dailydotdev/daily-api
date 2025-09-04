import type z from 'zod';
import { ChildEntity, Column, Index, JoinColumn, ManyToOne } from 'typeorm';
import { OpportunityType } from '@dailydotdev/schema';
import { Opportunity } from './Opportunity';
import type { Organization } from '../Organization';
import type { locationSchema } from '../../common/schema/userCandidate';

@ChildEntity(OpportunityType.JOB)
export class OpportunityJob extends Opportunity {
  @Column({ type: 'text' })
  @Index('IDX_opportunity_organization_id')
  organizationId: string;

  @Column({ type: 'jsonb', default: '[]' })
  location: z.infer<typeof locationSchema>[];

  @ManyToOne('Organization', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'organizationId',
    foreignKeyConstraintName: 'FK_opportunity_organization_id',
  })
  organization: Promise<Organization>;
}
