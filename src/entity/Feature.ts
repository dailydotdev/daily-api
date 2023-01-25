import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from './User';

export enum FeatureType {
  Squad = 'squad',
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
}
