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
import type {
  OpportunityContent,
  OpportunityMeta,
  OpportunityState,
  OpportunityType,
} from '@dailydotdev/schema';
import type { OpportunityUser } from './user';
import type { OpportunityKeyword } from '../OpportunityKeyword';
import type { OpportunityMatch } from '../OpportunityMatch';
import type { QuestionScreening } from '../questions/QuestionScreening';

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

  @Column({ type: 'integer', comment: 'OpportunityType from protobuf schema' })
  @Index('IDX_opportunity_type')
  type: OpportunityType;

  @Column({ type: 'integer', comment: 'OpportunityState from protobuf schema' })
  state: OpportunityState;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  tldr: string;

  @Column({
    type: 'jsonb',
    default: {},
    comment: 'OpportunityContent from protobuf schema',
  })
  content: OpportunityContent;

  @Column({
    type: 'jsonb',
    default: {},
    comment: 'OpportunityMeta from protobuf schema',
  })
  meta: OpportunityMeta;

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
