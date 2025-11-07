import { ChildEntity, Column, JoinColumn, ManyToOne } from 'typeorm';
import { Question } from './Question';
import { QuestionType } from './types';
import type { Opportunity } from '../opportunities/Opportunity';

@ChildEntity(QuestionType.Feedback)
export class QuestionFeedback extends Question {
  @Column({ type: 'uuid' })
  opportunityId: string;

  @ManyToOne(
    'Opportunity',
    (opportunity: Opportunity) => opportunity.feedbackQuestions,
    { lazy: true, onDelete: 'CASCADE' },
  )
  @JoinColumn({
    name: 'opportunityId',
    foreignKeyConstraintName: 'FK_question_feedback_opportunity_id',
  })
  opportunity: Promise<Opportunity>;
}
