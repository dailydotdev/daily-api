import {
  Column,
  Entity,
  EntityManager,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './User';
import { AddPostData } from './Post';

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
  reason: string;

  @ManyToOne(() => User, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;
}

export const validateAndApproveSubmission = async (
  entityManager: EntityManager,
  data: AddPostData,
): Promise<{ scoutId?: string; rejected?: boolean }> => {
  if (!data.submissionId) {
    return null;
  }

  const submission = await entityManager
    .getRepository(Submission)
    .findOne(data.submissionId);
  if (!submission) {
    return null;
  }

  if (data.authorId === submission.userId) {
    await entityManager.getRepository(Submission).update(
      { id: data.submissionId },
      {
        status: SubmissionStatus.Rejected,
        reason: 'scout and author are the same',
      },
    );
    return { rejected: true };
  }

  await entityManager.getRepository(Submission).update(
    { id: data.submissionId },
    {
      status: SubmissionStatus.Accepted,
    },
  );

  return { scoutId: submission.userId };
};
