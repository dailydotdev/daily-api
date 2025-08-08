import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  TableInheritance,
  UpdateDateColumn,
} from 'typeorm';
import type { User } from '../user';

export enum CampaignType {
  Post = 'post',
  Source = 'source',
}

export enum CampaignState {
  Pending = 'pending',
  Active = 'active',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

export interface CampaignFlags {
  budget: number;
  spend: number;
  impressions: number;
  clicks: number;
  users: number;
}

@Entity()
@Index('IDX_campaign_state_created_at_sort', { synchronize: false })
@TableInheritance({ column: { type: 'varchar', name: 'type' } })
export class Campaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  referenceId: string;

  @Column({ type: 'text' })
  userId: string;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;

  @Column({ type: 'text' })
  @Index('IDX_campaign_type')
  type: CampaignType;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column()
  endedAt: Date;

  @Column({ type: 'text' })
  state: CampaignState;

  @Column({ type: 'jsonb', default: {} })
  flags: Partial<CampaignFlags>;
}
