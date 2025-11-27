import { ApolloError } from 'apollo-server-errors';
import { QueryFailedError } from 'typeorm';
import { submissionLimit } from './config';
import { BookmarkListCountLimit, maxBookmarksPerMutation } from './types';
import { ParseError, TransferResponse } from '@dailydotdev/schema';
import type { JsonValue } from '@bufbuild/protobuf';

export enum UserFailErrorKeys {
  GenericError = 'GENERIC_ERROR',
  MissingFields = 'MISSING_FIELDS',
  UserExists = 'USER_EXISTS',
  UsernameEmailExists = 'USERNAME_EMAIL_EXISTS',
  DeletedUserCollision = 'DELETED_USER_COLLISION',
}

export enum UpdateUserFailErrorKeys {
  MissingFields = 'MISSING_FIELDS',
  UserDoesntExist = 'USER_DOESNT_EXIST',
  EmailExists = 'EMAIL_EXISTS',
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
  InviteLimitReached = 'INVITE_LIMIT_REACHED',
  OnboardingTagLimitReached = 'ONBOARDING_TAG_LIMIT_REACHED',
  FeedCountLimitReached = 'FEED_COUNT_LIMIT_REACHED',
  FeedNameRequired = 'FEED_NAME_REQUIRED',
  FeedNameInvalid = 'FEED_NAME_INVALID',
  FeedNameLength = 'FEED_NAME_LENGTH',
  FeedIconInvalid = 'FEED_ICON_INVALID',
  FeedThresholdInvalid = 'FEED_THRESHOLD_INVALID',
  CommunityPicksDeprecated = 'COMMUNITY_PICKS_DEPRECATED',
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
    'Unfortunately the article submitted is written by a creator who violated our community guidelines and is banned. We no longer accept submissions from this creator.',
  ACCESS_DENIED:
    'You do not have sufficient permissions and or reputation to submit a community link yet.',
  LIMIT_REACHED: `You can only submit ${submissionLimit} links per day and have reached your limit. Please try again tomorrow.`,
  INVITE_LIMIT_REACHED: 'You have reached your limit of available invites',
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
  ONBOARDING_TAG_LIMIT_REACHED: 'Tag limit reached',
  FEED_COUNT_LIMIT_REACHED:
    'You have reached maximum number of feeds for your user',
  FEED_NAME_REQUIRED: 'Feed name is required',
  FEED_NAME_INVALID: 'Feed name should not contain special characters',
  FEED_NAME_LENGTH: 'Feed name is too long',
  FEED_ICON_INVALID: 'Feed icon is invalid',
  FEED_THRESHOLD_INVALID: 'Feed threshold should be between 0 and 1000',
  COMMUNITY_PICKS_DEPRECATED:
    'The community picks feature has been deprecated and is no longer available. Please update your extension to remove this feature.',
};

export enum SourceRequestErrorKeys {
  AccessDenied = 'ACCESS_DENIED',
  SquadIneligible = 'SQUAD_INELIGIBLE',
}

export const SourceRequestErrorMessage: Record<SourceRequestErrorKeys, string> =
  {
    [SourceRequestErrorKeys.AccessDenied]:
      'You do not have sufficient permissions and or reputation to submit a source request yet.',
    [SourceRequestErrorKeys.SquadIneligible]:
      'Squad has not been approved yet of becoming public',
  };

export enum BookmarkFailErrorKeys {
  UserNotPlus = 'USER_NOT_PLUS',
  FolderFreeLimitReached = 'FOLDER_FREE_LIMIT_REACHED',
  FolderPlusLimitReached = 'FOLDER_PLUS_LIMIT_REACHED',
  ExceedsMutationLimit = 'EXCEEDS_MUTATION_LIMIT',
  InvalidIconOrName = 'INVALID_ICON_OR_NAME',
}

export const BookmarkErrorMessage: Record<BookmarkFailErrorKeys, string> = {
  [BookmarkFailErrorKeys.UserNotPlus]:
    'You need to be a Plus member to use this feature',
  [BookmarkFailErrorKeys.FolderFreeLimitReached]: `You have reached the maximum list count (${BookmarkListCountLimit.Free}) for free users`,
  [BookmarkFailErrorKeys.FolderPlusLimitReached]: `You have reached the maximum list count (${BookmarkListCountLimit.Plus})`,
  [BookmarkFailErrorKeys.ExceedsMutationLimit]: `Exceeded the maximum bookmarks per mutation (${maxBookmarksPerMutation})`,
  [BookmarkFailErrorKeys.InvalidIconOrName]: 'Invalid icon or name',
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
  USER_CONSTRAINT = 'FK_dce2a8927967051c447ae10bc8b',
  DEADLOCK_DETECTED = '40P01',
}

export enum SourcePermissionErrorKeys {
  InviteInvalid = 'SOURCE_PERMISSION_INVITE_INVALID',
}

// Return 409 HTTP status code
export class ConflictError extends ApolloError {
  constructor(message: string, extensions: Record<string, unknown> = {}) {
    super(message, 'CONFLICT', extensions);

    Object.defineProperty(this, 'name', { value: 'ConflictError' });
  }
}

export enum SlackApiErrorCode {
  MethodNotSupportedForChannelType = 'method_not_supported_for_channel_type',
}

export type SlackApiError = Error & {
  data?: {
    ok: boolean;
    error: SlackApiErrorCode;
  };
};

export type TypeORMQueryFailedError = QueryFailedError & {
  code?: string;
  constraint?: string;
  detail?: string;
};

export class RedirectError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 307) {
    super(message);

    this.statusCode = statusCode;
  }
}

export enum NjordErrorMessages {
  BalanceAccountNotFound = 'get balance error: account not found',
}

export class TransferError extends Error {
  transfer: TransferResponse;

  constructor(transfer: TransferResponse) {
    super(transfer.errorMessage || 'Transfer error');

    this.transfer = transfer;
  }
}

export class DeletedUserCollisionError extends Error {
  constructor(message: string = 'Deleted user collision error') {
    super(message);
  }
}

export class PurchaseTypeError extends Error {
  type?: string;

  constructor(message: string = 'Purchase type error', type?: string) {
    super(message);

    this.type = type;
  }
}

export class ParseCVProfileError extends Error {
  private errors: Array<JsonValue> = [];

  constructor(payload: { message: string; errors?: Array<ParseError> }) {
    super(payload.message);

    if (Array.isArray(payload.errors)) {
      this.errors = payload.errors.map((error) => {
        if (error instanceof ParseError) {
          return error.toJson();
        }

        return error;
      });
    }
  }
}
