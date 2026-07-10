import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ContributionAction } from './ContributionAction';

// A pool of target links for a single action (e.g. hundreds of community
// questions to answer). The UI surfaces a randomized handful at a time.
@Entity()
@Index('IDX_contribution_action_link_action_active', [
  'actionId',
  'active',
  'sortOrder',
])
export class ContributionActionLink {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_contribution_action_link_id',
  })
  id: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'uuid' })
  actionId: string;

  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'text', nullable: true, default: null })
  label: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'integer', default: 0 })
  sortOrder: number;

  @ManyToOne('ContributionAction', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'actionId',
    foreignKeyConstraintName: 'FK_contribution_action_link_action_id',
  })
  action: Promise<ContributionAction>;
}
