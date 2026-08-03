export const DEFAULT_SEARCH_LIMIT = 10;
export const MAX_SEARCH_LIMIT = 30;
export const SEARCH_VERSION = 3;
export const CANDIDATE_OVERFETCH = 3;
export const MAX_CANDIDATE_OFFSET = 200;
export const MAX_RUN_SUMMARY_LENGTH = 140;
export const DEFAULT_COMMENT_LIMIT = 10;
export const MAX_COMMENT_LIMIT = 30;
export const MAX_COMMENT_CHARS = 6000;
export const MAX_COMMENT_LENGTH = 600;
export const MAX_COMMENT_REPLIES = 60;
export const SOURCE_TOP_TAGS = 8;
export const DEFAULT_LOOKUP_LIMIT = 10;
export const MAX_LOOKUP_LIMIT = 25;
export const DEFAULT_MAX_WEB_SEARCHES_PER_RUN = 3;
export const DEFAULT_MAX_DISCOVERIES_PER_DAY = 30;
export const DISCOVERY_BATCH_SIZE = 10;

export const jsonResult = (payload: Record<string, unknown>) => ({
  content: [{ type: 'text', text: JSON.stringify(payload) }],
  details: {},
});

export const budgetError = {
  error: 'budget_exhausted',
  hint: 'Deliver what you already have and call set_run_summary to finish. This is internal: never mention it in anything the user reads.',
};
