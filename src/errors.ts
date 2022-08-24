import { ApolloError } from 'apollo-server-errors';

export type UserFailErrorKeys =
  | 'GENERIC_ERROR'
  | 'MISSING_FIELDS'
  | 'USER_EXISTS'
  | 'USERNAME_EMAIL_EXISTS';

export type UpdateUserFailErrorKeys = 'MISSING_FIELDS' | 'USER_DOESNT_EXIST';

export type SubmissionFailErrorKeys =
  | 'GENERIC_ERROR'
  | 'PAYWALL'
  | 'MISSING_FIELDS'
  | 'SCOUT_IS_AUTHOR'
  | 'POST_EXISTS'
  | 'AUTHOR_BANNED'
  | 'ACCESS_DENIED'
  | 'LIMIT_REACHED'
  | 'INVALID_URL'
  | 'POST_DELETED'
  | 'EXISTS_STARTED'
  | 'EXISTS_ACCEPTED'
  | 'EXISTS_REJECTED';

export const SubmissionFailErrorMessage: Record<
  SubmissionFailErrorKeys,
  string
> = {
  GENERIC_ERROR:
    'Unfortunately there was an error and we were unable to gather the required information from the URL submitted to add',
  PAYWALL:
    'Unfortunately the article submitted is behind a paywall, so we cannot add it to the daily.dev feed.',
  MISSING_FIELDS:
    'Unfortunately we ran into a problem adding this article, our team is looking into it.',
  SCOUT_IS_AUTHOR:
    'You can’t submit your own articles as community picks, please suggest articles by other people.',
  POST_EXISTS: 'This post is already on daily.dev!',
  AUTHOR_BANNED:
    'Unfortunately the article submitted is written by an author who violated our community guidelines and is banned. We no longer accept submissions from this author.',
  ACCESS_DENIED:
    'You do not have sufficient permissions and or reputation to submit a community link yet.',
  LIMIT_REACHED:
    'You can only submit 3 links per day and have reached your limit. Please try again tomorrow.',
  INVALID_URL:
    'The URL you submitted is not valid, please check and try again.',
  POST_DELETED:
    'This post has previously appeared in the daily.dev feed but was deleted and cannot be added to the feed again.',
  EXISTS_STARTED:
    'This article has already been submitted and is currently being processed.',
  EXISTS_ACCEPTED:
    'This article has already been submitted and is currently being added to the daily.dev feed',
  EXISTS_REJECTED:
    'This article has already been submitted but did not meet our technical requirements, it cannot be submitted again',
};

export class NotFoundError extends ApolloError {
  constructor(message: string) {
    super(message, 'NOT_FOUND');

    Object.defineProperty(this, 'name', { value: 'NotFoundError' });
  }
}

export enum TypeOrmError {
  DUPLICATE_ENTRY = '23505',
}
