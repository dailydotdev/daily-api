import { ApolloError } from 'apollo-server-errors';

export enum UserFailErrorKeys {
  GenericError = 'GENERIC_ERROR',
  MissingFields = 'MISSING_FIELDS',
  UserExists = 'USER_EXISTS',
  UsernameEmailExists = 'USERNAME_EMAIL_EXISTS',
}

export enum UpdateUserFailErrorKeys {
  MissingFields = 'MISSING_FIELDS',
  UserDoesntExist = 'USER_DOESNT_EXIST',
}

export enum SubmissionFailErrorKeys {
  GenericError = 'GENERIC_ERROR',
  Paywall = 'PAYWALL',
  MissingFields = 'MISSING_FIELDS',
  ScoutIsAuthor = 'SCOUT_IS_AUTHOR',
  PostExists = 'POST_EXISTS',
  AuthorBanned = 'AUTHOR_BANNED',
  AccessDenied = 'ACCESS_DENIED',
  LimitReached = 'LIMIT_REACHED',
  InvalidUrl = 'INVALID_URL',
  PostDeleted = 'POST_DELETED',
  ExistsStarted = 'EXISTS_STARTED',
  ExistsAccepted = 'EXISTS_ACCEPTED',
  ExistsRejected = 'EXISTS_REJECTED',
}

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
  NULL_VIOLATION = '23502',
  FOREIGN_KEY = '23503',
  DUPLICATE_ENTRY = '23505',
}

export enum SourcePermissionErrorKeys {
  InviteInvalid = 'SOURCE_PERMISSION_INVITE_INVALID',
}
