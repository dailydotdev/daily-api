import { ChildEntity, Column, JoinColumn, ManyToOne } from 'typeorm';
import { Question } from './Question';
import { QuestionType } from './types';
import type { Opportunity } from '../opportunities/Opportunity';

@ChildEntity(QuestionType.Screening)
export class QuestionScreening extends Question {
  @Column({ type: 'uuid' })
  opportunityId: string;

  @ManyToOne(
    'Opportunity',
    (opportunity: Opportunity) => opportunity.questions,
    { lazy: true, onDelete: 'CASCADE' },
  )
  @JoinColumn({
    name: 'opportunityId',
    foreignKeyConstraintName: 'FK_question_screening_opportunity_id',
  })
  opportunity: Promise<Opportunity>;
}
