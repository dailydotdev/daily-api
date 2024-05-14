import { Column, Entity, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from './User';

export enum UserStateKey {
  CommunityLinkAccess = 'community_link_access',
}

@Entity()
export class UserState {
  @PrimaryColumn({ length: 36 })
  userId: string;

  @PrimaryColumn()
  key: string;

  @Column({ default: false })
  value: boolean;

  @ManyToOne(() => User, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;
}
