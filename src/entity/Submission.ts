import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user';
import { SubmissionFailErrorKeys } from '../errors';

export enum SubmissionStatus {
  Started = 'STARTED',
  Accepted = 'ACCEPTED',
  Rejected = 'REJECTED',
}

@Entity()
export class Submission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  url: string;

  @Index()
  @Column({ length: 36 })
  userId: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @Column({ default: SubmissionStatus.Started })
  status: string;

  @Column({ type: 'text' })
  reason: SubmissionFailErrorKeys;

  @ManyToOne(() => User, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;
}
