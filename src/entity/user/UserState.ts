import { Column, Entity, ManyToOne, PrimaryColumn } from 'typeorm';
import type { User } from './User';

/**
 * @deprecated This enum was used for the community picks granted feature which has been sunset.
 * Keeping this for backwards compatibility with existing database records.
 */
export enum UserStateKey {
  CommunityLinkAccess = 'community_link_access',
}

/**
 * @deprecated This entity was used for the community picks granted feature which has been sunset.
 * Keeping this for backwards compatibility with existing database records.
 * No new records should be created.
 */
@Entity()
export class UserState {
  @PrimaryColumn({ length: 36 })
  userId: string;

  @PrimaryColumn()
  key: string;

  @Column({ default: false })
  value: boolean;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;
}
