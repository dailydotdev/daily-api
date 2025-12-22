import type { EntityManager } from 'typeorm';
import { QuestionFeedback } from '../../entity/questions/QuestionFeedback';

export const addOpportunityDefaultQuestionFeedback = async ({
  entityManager,
  opportunityId,
}: {
  entityManager: EntityManager;
  opportunityId: string;
}): Promise<void> => {
  await entityManager.getRepository(QuestionFeedback).insert({
    opportunityId,
    title: 'Why did you reject this opportunity?',
    placeholder: `E.g., Not interested in the tech stack, location doesn't work for me, compensation too low...`,
  });
};
