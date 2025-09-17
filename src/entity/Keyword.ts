import {
  Column,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum KeywordStatus {
  Pending = 'pending',
  Allow = 'allow',
  Deny = 'deny',
  Synonym = 'synonym',
}

export type KeywordFlags = Partial<{
  onboarding: boolean;
  title: string;
  description: string;
  roadmap: string;
}>;

export type KeywordFlagsPublic = Pick<
  KeywordFlags,
  'title' | 'description' | 'roadmap'
>;

@Entity()
@Index('IDX_status_value', ['status', 'value'])
@Index('IDX_keyword_flags_onboarding_value_text', { synchronize: false })
@Index('IDX_keyword_status_value_occurrences', [
  'status',
  'value',
  'occurrences',
])
@Index('IDX_keyword_value_trgm_allow_synonym', { synchronize: false })
@Index('IDX_keyword_status_occ_value', { synchronize: false })
export class Keyword {
  @PrimaryColumn({ type: 'text' })
  @Index('IDX_keyword_value')
  value: string;

  @Column({
    type: 'text',
    default: 'pending',
  })
  @Index('IDX_keyword_status')
  status: KeywordStatus;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'text', nullable: true })
  synonym?: string;

  @UpdateDateColumn()
  @Index('IDX_keyword_updatedAt')
  updatedAt: Date;

  @Column({ default: 1 })
  @Index('IDX_keyword_occurrences')
  occurrences: number;

  @Column({ type: 'jsonb', default: {} })
  flags: KeywordFlags = {};
}
