import {
  UserFeedbackCategory,
  UserFeedbackSentiment,
} from '@dailydotdev/schema';

const USER_FEEDBACK_CATEGORY_UX_ISSUE = 5;
const USER_FEEDBACK_CATEGORY_PERFORMANCE = 6;
const USER_FEEDBACK_CATEGORY_CONTENT_QUALITY = 7;

const categoryDisplayNames: Record<number, string> = {
  [UserFeedbackCategory.BUG]: 'Bug Report',
  [UserFeedbackCategory.FEATURE_REQUEST]: 'Feature Request',
  [UserFeedbackCategory.GENERAL]: 'General Feedback',
  [UserFeedbackCategory.OTHER]: 'Other',
  [USER_FEEDBACK_CATEGORY_UX_ISSUE]: 'UX Issue',
  [USER_FEEDBACK_CATEGORY_PERFORMANCE]: 'Performance',
  [USER_FEEDBACK_CATEGORY_CONTENT_QUALITY]: 'Content Quality',
};

const categoryLabelNames: Record<number, string> = {
  [UserFeedbackCategory.BUG]: 'bug',
  [UserFeedbackCategory.FEATURE_REQUEST]: 'feature-request',
  [UserFeedbackCategory.GENERAL]: 'general',
  [UserFeedbackCategory.OTHER]: 'other',
  [USER_FEEDBACK_CATEGORY_UX_ISSUE]: 'ux-issue',
  [USER_FEEDBACK_CATEGORY_PERFORMANCE]: 'performance',
  [USER_FEEDBACK_CATEGORY_CONTENT_QUALITY]: 'content-quality',
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
