import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import type { User } from './user';

export enum FeatureType {
  Team = 'team',
  Squad = 'squad',
  Search = 'search',
  Standup = 'standup',
  // Granted by claiming a `suggest_causes` contribution reward; gates the right
  // to nominate causes for the giveback campaign.
  ContributionSuggestCauses = 'contribution_suggest_causes',
}

export enum FeatureValue {
  Allow = 1,
  Block = -1,
}

@Entity()
export class Feature {
  @PrimaryColumn({ type: 'text' })
  feature: FeatureType;

  @PrimaryColumn({ length: 36 })
  @Index('IDX_feature_userId')
  userId: string;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'smallint', default: FeatureValue.Allow })
  value: FeatureValue = FeatureValue.Allow;

  @Column({ length: 36, nullable: true })
  invitedById: string;

  @ManyToOne('User', { lazy: true, nullable: true, onDelete: 'SET NULL' })
  invitedBy: Promise<User | null>;
}
