import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from './User';

export enum SubmissionStatus {
  NotStarted = 'NOT_STARTED',
  Started = 'STARTED',
  Accepted = 'ACCEPTED',
  Rejected = 'REJECTED',
}

@Entity()
export class Submission {
  @PrimaryColumn({ type: 'text' })
  url: string;

  @Index()
  @Column({ length: 36 })
  userId: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @Column({ default: SubmissionStatus.NotStarted })
  status: string;

  @ManyToOne(() => User, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;
}
