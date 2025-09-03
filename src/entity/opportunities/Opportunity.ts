import z from 'zod';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  TableInheritance,
  UpdateDateColumn,
} from 'typeorm';
import type { OpportunityState } from '@dailydotdev/schema';
import type { OpportunityType } from './types';
import type { OpportunityUser } from './user';
import type { OpportunityKeyword } from '../OpportunityKeyword';
import type { OpportunityMatch } from '../OpportunityMatch';
import type { QuestionScreening } from '../questions/QuestionScreening';
import type {
  opportunityContentSchema,
  opportunityMetaSchema,
} from '../../common/schema/opportunities';

@Entity()
@TableInheritance({ column: { type: 'text', name: 'type' } })
export class Opportunity {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_Opportunity_Id',
  })
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'text' })
  @Index('IDX_opportunity_type')
  type: OpportunityType;

  @Column({ type: 'text' })
  state: OpportunityState;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  tldr: string;

  @Column({ type: 'jsonb', default: {} })
  content: z.infer<typeof opportunityContentSchema>[];

  @Column({ type: 'jsonb', default: {} })
  meta: z.infer<typeof opportunityMetaSchema>;

  @OneToMany('OpportunityUser', (user: OpportunityUser) => user.opportunity, {
    lazy: true,
  })
  users: Promise<OpportunityUser[]>;

  @OneToMany(
    'OpportunityKeyword',
    (keyword: OpportunityKeyword) => keyword.opportunity,
    { lazy: true },
  )
  keywords: Promise<OpportunityKeyword[]>;

  @OneToMany(
    'OpportunityMatch',
    (match: OpportunityMatch) => match.opportunity,
    { lazy: true },
  )
  matches: Promise<OpportunityMatch[]>;

  @OneToMany(
    'QuestionScreening',
    (question: QuestionScreening) => question.opportunity,
    { lazy: true },
  )
  questions: Promise<QuestionScreening[]>;
}
