import {
  Column,
  Entity,
  EntityManager,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './User';
import { RejectPostData } from './Post';

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

export const rejectSubmission = async (
  entityManager: EntityManager,
  data: RejectPostData,
): Promise<string> => {
  await entityManager.getRepository(Submission).update(
    { id: data.submissionId },
    {
      status: SubmissionStatus.Rejected,
      reason: data.reason,
    },
  );

  return data.submissionId;
};

export const validateSubmission = async (
  entityManager: EntityManager,
  id: string,
): Promise<string> => {
  if (!id) {
    return null;
  }

  const submission = await entityManager
    .getRepository(Submission)
    .findOneOrFail(id);
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
