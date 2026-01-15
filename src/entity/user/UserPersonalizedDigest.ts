import { Column, Entity, Index, OneToOne, PrimaryColumn } from 'typeorm';
import type { User } from './';
import { DayOfWeek } from '../../common';

export enum UserPersonalizedDigestSendType {
  weekly = 'weekly',
  workdays = 'workdays',
  daily = 'daily',
}

export enum UserPersonalizedDigestType {
  Digest = 'digest',
  ReadingReminder = 'reading_reminder',
  StreakReminder = 'streak_reminder',
  Brief = 'brief',
}

export type UserPersonalizedDigestFlags = Partial<{
  sendType: UserPersonalizedDigestSendType;
}>;

export type UserPersonalizedDigestFlagsPublic = Pick<
  UserPersonalizedDigestFlags,
  'sendType'
>;

@Entity()
export class UserPersonalizedDigest {
  @PrimaryColumn({ type: 'text' })
  userId: string;

  @PrimaryColumn({ type: 'text', default: UserPersonalizedDigestType.Digest })
  type = UserPersonalizedDigestType.Digest;

  @Column({ type: 'smallint', default: 9 })
  preferredHour: number;

  @Index()
  @Column({ type: 'smallint', default: DayOfWeek.Monday })
  preferredDay = DayOfWeek.Monday;

  @Column({ default: 1, nullable: false })
  variation: number;

  @Column({ nullable: true })
  lastSendDate: Date;

  @Column({ type: 'jsonb', default: {} })
  @Index('IDX_user_personalized_digest_flags_sendType', { synchronize: false })
  flags: UserPersonalizedDigestFlags = {};

  @OneToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;
}
