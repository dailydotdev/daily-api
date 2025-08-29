import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  TableInheritance,
} from 'typeorm';
import type { User } from '../../user';
import type { Opportunity } from '../Opportunity';
import type { OpportunityUserType } from '../types';

@Entity()
@TableInheritance({ column: { type: 'text', name: 'type' } })
export class OpportunityUser {
  @PrimaryColumn({
    type: 'text',
    primaryKeyConstraintName: 'PK_opportunity_user_opportunity_id_user_id',
  })
  opportunityId: string;

  @PrimaryColumn({
    type: 'text',
    primaryKeyConstraintName: 'PK_opportunity_user_opportunity_id_user_id',
  })
  @Index('IDX_opportunity_user_user_id')
  userId: string;

  @Column({ type: 'text' })
  @Index('IDX_opportunity_user_type')
  type: OpportunityUserType;

  @ManyToOne('Opportunity', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'opportunityId',
    foreignKeyConstraintName: 'FK_opportunity_user_opportunity_id',
  })
  opportunity: Promise<Opportunity>;

  @ManyToOne('User', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_opportunity_user_user_id',
  })
  user: Promise<User>;
}
