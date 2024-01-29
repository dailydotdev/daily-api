import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from './user';

export enum FeatureType {
  Squad = 'squad',
  Search = 'search',
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

  @ManyToOne(() => User, {
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

  @ManyToOne(() => User, { lazy: true, nullable: true, onDelete: 'SET NULL' })
  invitedBy: Promise<User | null>;
}
