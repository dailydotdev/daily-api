import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ContributionActionCategory } from './ContributionActionCategory';

export type ContributionEvidenceSchema = {
  url?: {
    required?: boolean;
    allowedDomains?: string[];
  };
  screenshot?: {
    required?: boolean;
  };
  note?: {
    required?: boolean;
  };
};

export enum ContributionAssistType {
  ExternalLink = 'external_link',
  ReferralLink = 'referral_link',
  LinkPool = 'link_pool',
}

export type ContributionActionMetadata = {
  platform?: string;
  instructions?: string;
  externalUrl?: string;
  isLoveAction?: boolean;
  // How the UI helps the user complete the action: open a link, surface their
  // referral link, or pick from a rotating pool (contribution_action_link).
  assistType?: ContributionAssistType;
};

@Entity()
@Index('IDX_contribution_action_active_sort', [
  'active',
  'sortOrder',
  'createdAt',
])
@Index('IDX_contribution_action_categoryId', ['categoryId'])
export class ContributionAction {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_contribution_action_id',
  })
  id: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'uuid', nullable: true, default: null })
  categoryId: string | null;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true, default: null })
  description: string | null;

  @Column({ type: 'integer' })
  points: number;

  @Column({ type: 'jsonb', default: {} })
  evidence: ContributionEvidenceSchema;

  @Column({ type: 'jsonb', default: {} })
  metadata: ContributionActionMetadata;

  @Column({ type: 'integer', nullable: true, default: null })
  cooldownSeconds: number | null;

  @Column({ type: 'integer', nullable: true, default: null })
  maxPerUser: number | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'integer', default: 0 })
  sortOrder: number;

  @ManyToOne('ContributionActionCategory', {
    lazy: true,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'categoryId',
    foreignKeyConstraintName: 'FK_contribution_action_category_id',
  })
  category: Promise<ContributionActionCategory | null>;
}
