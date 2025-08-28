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
import {
  OpportunityState,
  OpportunityType,
  OpportunityContentSchema,
  OpportunityMetaSchema,
} from './types';
import type { OpportunityUser } from './user';
import type { OpportunityKeyword } from '../OpportunityKeyword';
import type { OpportunityMatch } from '../OpportunityMatch';

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
  content: z.infer<typeof OpportunityContentSchema>[];

  @Column({ type: 'jsonb', default: {} })
  meta: z.infer<typeof OpportunityMetaSchema>;

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
}
