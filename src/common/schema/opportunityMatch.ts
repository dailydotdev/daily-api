import z from 'zod';

export const feedbackClassificationSchema = z.object({
  platform: z.number(),
  category: z.number(),
  sentiment: z.number(),
  urgency: z.number(),
});

export const opportunityFeedbackSchema = z.object({
  screening: z.string(),
  answer: z.string(),
  classification: feedbackClassificationSchema.optional(),
});

export type OpportunityFeedback = z.infer<typeof opportunityFeedbackSchema>;
export type FeedbackClassification = z.infer<
  typeof feedbackClassificationSchema
>;

export const opportunityScreeningAnswersSchema = z.object({
  id: z.uuid(),
  answers: z
    .array(
      z.object({
        questionId: z.uuid(),
        answer: z.string().max(500),
      }),
    )
    .superRefine((answers, ctx) => {
      const seen = new Map();
      answers.forEach((answer, i) => {
        if (seen.has(answer.questionId)) {
          ctx.addIssue({
            code: 'custom',
            message: `Duplicate questionId ${answer.questionId}`,
            path: [i],
          });
        } else {
          seen.set(answer.questionId, i);
        }
      });
    }),
});

export const opportunityFeedbackAnswersSchema = z.object({
  id: z.uuid(),
  answers: z
    .array(
      z.object({
        questionId: z.uuid(),
        answer: z.string().max(500),
      }),
    )
    .superRefine((answers, ctx) => {
      const seen = new Map();
      answers.forEach((answer, i) => {
        if (seen.has(answer.questionId)) {
          ctx.addIssue({
            code: 'custom',
            message: `Duplicate questionId ${answer.questionId}`,
            path: [i],
          });
        } else {
          seen.set(answer.questionId, i);
        }
      });
    }),
});
