import {
  UserFeedbackCategory,
  UserFeedbackSentiment,
} from '@dailydotdev/schema';

const categoryDisplayNames: Record<number, string> = {
  [UserFeedbackCategory.BUG]: 'Bug Report',
  [UserFeedbackCategory.FEATURE_REQUEST]: 'Feature Request',
  [UserFeedbackCategory.GENERAL]: 'General Feedback',
  [UserFeedbackCategory.OTHER]: 'Other',
  [UserFeedbackCategory.UX_ISSUE]: 'UX Issue',
  [UserFeedbackCategory.PERFORMANCE]: 'Performance',
  [UserFeedbackCategory.CONTENT_QUALITY]: 'Content Quality',
};

const categoryLabelNames: Record<number, string> = {
  [UserFeedbackCategory.BUG]: 'bug',
  [UserFeedbackCategory.FEATURE_REQUEST]: 'feature-request',
  [UserFeedbackCategory.GENERAL]: 'general',
  [UserFeedbackCategory.OTHER]: 'other',
  [UserFeedbackCategory.UX_ISSUE]: 'ux-issue',
  [UserFeedbackCategory.PERFORMANCE]: 'performance',
  [UserFeedbackCategory.CONTENT_QUALITY]: 'content-quality',
};

export const getCategoryDisplayName = (category: number): string => {
  return categoryDisplayNames[category] ?? 'Feedback';
};

export const getCategoryLabelName = (category: number): string => {
  return categoryLabelNames[category] ?? 'unknown';
};

export const getSentimentEmoji = (sentiment?: string): string => {
  switch (Number(sentiment)) {
    case UserFeedbackSentiment.POSITIVE:
      return '😊';
    case UserFeedbackSentiment.NEGATIVE:
      return '😟';
    case UserFeedbackSentiment.NEUTRAL:
      return '😐';
    case UserFeedbackSentiment.MIXED:
      return '🤔';
    default:
      return '📝';
  }
};
