import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  TableInheritance,
} from 'typeorm';
import type { QuestionType } from './types';

@Entity()
@TableInheritance({ column: { type: 'text', name: 'type' } })
export class Question {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_question_id',
  })
  id: string;

  @Column({ type: 'text' })
  @Index('IDX_question_type')
  type: QuestionType;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', default: null })
  placeholder: string | null;

  @Column({ type: 'smallint', default: 0 })
  questionOrder: number;
}
