export const DEFAULT_SEARCH_LIMIT = 10;
export const MAX_SEARCH_LIMIT = 30;
export const SEARCH_VERSION = 3;
export const MAX_CANDIDATE_OFFSET = 200;
export const MAX_RUN_SUMMARY_LENGTH = 140;
export const DEFAULT_COMMENT_LIMIT = 100;
export const MAX_COMMENT_LIMIT = 100;
export const MAX_COMMENT_LENGTH = 180;
export const SOURCE_TOP_TAGS = 8;
export const DEFAULT_TAG_SCOPE_PERIOD_DAYS = 30;
export const DEFAULT_LOOKUP_LIMIT = 10;
export const MAX_LOOKUP_LIMIT = 25;
export const DEFAULT_MAX_WEB_SEARCHES_PER_RUN = 3;
export const DEFAULT_MAX_DISCOVERIES_PER_DAY = 30;
export const DISCOVERY_BATCH_SIZE = 10;

export const UNTRUSTED_OPEN = '<user_content>';
export const UNTRUSTED_CLOSE = '</user_content>';
const UNTRUSTED_OPEN_ESCAPED = '&lt;user_content>';
const UNTRUSTED_CLOSE_ESCAPED = '&lt;/user_content>';

export const hasUntrustedDelimiter = (
  text: string | null | undefined,
): boolean =>
  typeof text === 'string' &&
  (text.includes(UNTRUSTED_OPEN) || text.includes(UNTRUSTED_CLOSE));

export const wrapUntrusted = <T extends string | null | undefined>(
  text: T,
): T | string =>
  typeof text === 'string' && text.length
    ? `${UNTRUSTED_OPEN}${text
        .split(UNTRUSTED_OPEN)
        .join(UNTRUSTED_OPEN_ESCAPED)
        .split(UNTRUSTED_CLOSE)
        .join(UNTRUSTED_CLOSE_ESCAPED)}${UNTRUSTED_CLOSE}`
    : text;

export const jsonResult = (payload: Record<string, unknown>) => ({
  content: [{ type: 'text', text: JSON.stringify(payload) }],
  details: {},
});

export const budgetError = {
  error: 'budget_exhausted',
  hint: 'Deliver what you already have and call set_run_summary to finish. This is internal: never mention it in anything the user reads.',
};
