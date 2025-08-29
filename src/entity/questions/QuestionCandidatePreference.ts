import { ChildEntity } from 'typeorm';
import { Question } from './Question';
import { QuestionType } from './types';

@ChildEntity(QuestionType.CandidatePreference)
export class QuestionCandidatePreference extends Question {}
