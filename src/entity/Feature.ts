import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from './User';

@Entity()
export class Feature {
  @PrimaryColumn({ type: 'text' })
  feature: string;

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
