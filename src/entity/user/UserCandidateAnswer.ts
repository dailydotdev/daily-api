import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import type { User } from './User';
import type { Question } from '../questions/Question';

@Entity()
export class UserCandidateAnswer {
  @PrimaryColumn({
    type: 'text',
    primaryKeyConstraintName: 'PK_user_candidate_answer_user_id_question_id',
  })
  userId: string;

  @PrimaryColumn({
    type: 'text',
    primaryKeyConstraintName: 'PK_user_candidate_answer_user_id_question_id',
  })
  @Index('IDX_user_candidate_answer_question_id')
  questionId: string;

  @Column({ type: 'text' })
  answer: string;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_user_candidate_answer_user_id',
  })
  user: Promise<User>;

  @ManyToOne('Question', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'questionId',
    foreignKeyConstraintName: 'FK_user_candidate_answer_question_id',
  })
  question: Promise<Question>;
}
