import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import type { Opportunity } from './opportunities/Opportunity';

@Entity()
export class OpportunityKeyword {
  @PrimaryColumn({
    type: 'text',
    primaryKeyConstraintName: 'PK_opportunity_keyword_opportunity_id_keyword',
  })
  opportunityId: string;

  @PrimaryColumn({
    type: 'text',
    primaryKeyConstraintName: 'PK_opportunity_keyword_opportunity_id_keyword',
  })
  keyword: string;

  @ManyToOne('Opportunity', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'opportunityId',
    foreignKeyConstraintName: 'FK_opportunity_keyword_opportunity_id',
  })
  opportunity: Promise<Opportunity>;
}
