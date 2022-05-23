import {
  Column,
  Entity,
  EntityManager,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './User';

export enum SubmissionStatus {
  NotStarted = 'NOT_STARTED',
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

  @Column({ default: SubmissionStatus.NotStarted })
  status: string;

  @Column({ type: 'text' })
  reason: string;

  @ManyToOne(() => User, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;
}

export const validateAndApproveSubmission = async (
  entityManager: EntityManager,
  id: string,
): Promise<string> => {
  if (!id) {
    return null;
  }

  const submission = await entityManager.getRepository(Submission).findOne(id);
  if (!submission) {
    return null;
  }

  await entityManager.getRepository(Submission).update(
    { id },
    {
      status: SubmissionStatus.Accepted,
    },
  );

  return submission.userId;
};
