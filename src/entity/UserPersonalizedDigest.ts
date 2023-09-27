import { Column, Entity, OneToOne, PrimaryColumn } from 'typeorm';
import { User } from './';
import { DayOfWeek } from '../types';

@Entity()
export class UserPersonalizedDigest {
  @PrimaryColumn({ type: 'text' })
  userId: string;

  @Column({ type: 'smallint', default: 9 })
  preferredHour: number;

  @Column({ type: 'smallint', default: DayOfWeek.Monday })
  preferredDay = DayOfWeek.Monday;

  @Column({ type: 'text', default: 'Etc/UTC' })
  preferredTimezone: string;

  @OneToOne(() => User, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;
}
