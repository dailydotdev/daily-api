import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Opportunity } from './opportunities/Opportunity';
import type { User } from './user';
import { OpportunityMatchStatus } from './opportunities/types';
import type z from 'zod';
import {
  applicationScoreSchema,
  opportunityMatchDescriptionSchema,
} from '../common/schema/opportunities';
import type { Screening } from '@dailydotdev/schema';

@Entity()
export class OpportunityMatch {
  @PrimaryColumn({
    type: 'text',
    primaryKeyConstraintName: 'PK_opportunity_match_opportunity_id_user_id',
  })
  opportunityId: string;

  @PrimaryColumn({
    type: 'text',
    primaryKeyConstraintName: 'PK_opportunity_match_opportunity_id_user_id',
  })
  @Index('IDX_opportunity_match_user_id')
  userId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'text', default: OpportunityMatchStatus.Pending })
  status: OpportunityMatchStatus;

  @Column({ type: 'jsonb', default: '{}' })
  description: z.infer<typeof opportunityMatchDescriptionSchema>;

  @Column({ type: 'jsonb', default: '[]' })
  screening: Array<Screening>;

  @Column({ type: 'jsonb', default: '{}' })
  applicationRank: z.infer<typeof applicationScoreSchema>;

  @ManyToOne('Opportunity', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'opportunityId',
    foreignKeyConstraintName: 'FK_opportunity_match_opportunity_id',
  })
  opportunity: Promise<Opportunity>;

  @ManyToOne('User', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_opportunity_match_user_id',
  })
  user: Promise<User>;
}
