import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  Index,
  Generated,
} from 'typeorm';
import { User } from './user';
import { FeatureType } from './Feature';

export enum CampaignType {
  Search = 'search',
}

@Entity()
@Index('IDX_invite_userId_campaign', ['userId', 'campaign'], { unique: true })
export class Invite {
  @PrimaryColumn({ type: 'uuid' })
  @Generated('uuid')
  token: string;

  @Column({ type: 'text' })
  campaign: CampaignType | FeatureType;

  @Column({ length: 36 })
  userId: string;

  @ManyToOne(() => User, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;

  @Column({ type: 'int', default: 5 })
  limit: number;

  @Column({ type: 'int', default: 0 })
  count: number;
}
