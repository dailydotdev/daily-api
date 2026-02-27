import {
  UserFeedbackCategory,
  UserFeedbackSentiment,
} from '@dailydotdev/schema';

export const getCategoryDisplayName = (category: number): string => {
  switch (category) {
    case UserFeedbackCategory.BUG:
      return 'Bug Report';
    case UserFeedbackCategory.FEATURE_REQUEST:
      return 'Feature Request';
    case UserFeedbackCategory.GENERAL:
      return 'General Feedback';
    case UserFeedbackCategory.OTHER:
      return 'Other';
    case 5:
      return 'UX Issue';
    case 6:
      return 'Performance';
    case 7:
      return 'Content Quality';
    default:
      return 'Feedback';
  }
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
