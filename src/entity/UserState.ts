import { Column, Entity, PrimaryColumn } from 'typeorm';

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
}
