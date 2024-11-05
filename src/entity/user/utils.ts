import {
  TypeOrmError,
  UpdateUserFailErrorKeys,
  UserFailErrorKeys,
} from '../../errors';
import { ContentLanguage, validLanguages } from '../../types';
import { DataSource, DeepPartial, EntityManager } from 'typeorm';
import { FastifyBaseLogger, FastifyRequest } from 'fastify';
import { counters } from '../../telemetry';
import { generateTrackingId } from '../../ids';
import { fallbackImages } from '../../config';
import { validateAndTransformHandle } from '../../common/handles';
import {
  codepenSocialUrlMatch,
  DEFAULT_TIMEZONE,
  DEFAULT_WEEK_START,
  githubSocialUrlMatch,
  linkedinSocialUrlMatch,
  mastodonSocialUrlMatch,
  portfolioLimit,
  redditSocialUrlMatch,
  roadmapShSocialUrlMatch,
  safeJSONParse,
  socialUrlMatch,
  stackoverflowSocialUrlMatch,
  threadsSocialUrlMatch,
  twitterSocialUrlMatch,
  youtubeSocialUrlMatch,
} from '../../common';
import { ValidationError } from 'apollo-server-errors';
import { GQLUpdateUserInput } from '../../schema/users';
import { validateValidTimeZone } from '../../common/timezone';
import { nameRegex, validateRegex, ValidateRegex } from '../../common/object';
import { logger } from '../../logger';
import { User } from './User';
import { Feed } from '../Feed';

export type AddUserData = Pick<
  User,
  | 'id'
  | 'name'
  | 'image'
  | 'username'
  | 'email'
  | 'createdAt'
  | 'github'
  | 'twitter'
  | 'referralId'
  | 'referralOrigin'
  | 'infoConfirmed'
  | 'profileConfirmed'
  | 'acceptedMarketing'
  | 'timezone'
  | 'experienceLevel'
  | 'language'
>;
export type AddUserDataPost = { referral: string } & AddUserData;
export type UpdateUserEmailData = Pick<User, 'id' | 'email'>;
type AddNewUserResult =
  | { status: 'ok'; userId: string }
  | { status: 'failed'; reason: UserFailErrorKeys; error?: Error };

const checkLanguage = (language?: string | null): boolean => {
  if (!language) {
    return true;
  }

  return validLanguages.includes(language as ContentLanguage);
};

const checkRequiredFields = (data: AddUserData): boolean => {
  if (!checkLanguage(data.language)) {
    return false;
  }

  if (data?.username && !data?.experienceLevel) {
    return false;
  }
  return !!(data && data.id);
};

const checkEmail = async (
  entityManager: DataSource | EntityManager,
  email: string,
  id?: string,
): Promise<boolean> => {
  let query = entityManager
    .getRepository(User)
    .createQueryBuilder()
    .select('id')
    .where('lower(email) = :email', { email: email.toLowerCase() });
  if (id) {
    query = query.andWhere('id != :id', { id });
  }
  const user = await query.getRawOne();
  return !user;
};

type UpdateUserEmailResult =
  | { status: 'ok'; userId: string }
  | { status: 'failed'; reason: UpdateUserFailErrorKeys; error?: Error };
export const updateUserEmail = async (
  con: DataSource,
  data: UpdateUserEmailData,
  logger: FastifyBaseLogger,
): Promise<UpdateUserEmailResult> => {
  if (!data.email || !data.id) {
    return { status: 'failed', reason: UpdateUserFailErrorKeys.MissingFields };
  }

  const isEmailAvailable = await checkEmail(con, data.email, data.id);
  if (!isEmailAvailable) {
    return { status: 'failed', reason: UpdateUserFailErrorKeys.EmailExists };
  }

  try {
    const res = await con
      .getRepository(User)
      .update({ id: data.id }, { email: data.email.toLowerCase() });
    if (res.affected === 0) {
      logger.info(`Failed to update email user not found with ID: ${data.id}`);
      return {
        status: 'failed',
        reason: UpdateUserFailErrorKeys.UserDoesntExist,
      };
    }

    logger.info(`Updated email for user with ID: ${data.id}`);
    return { status: 'ok', userId: data.id };
  } catch (error) {
    logger.error(
      {
        data,
        userId: data.id,
        error,
      },
      'failed to update user email',
    );

    throw error;
  }
};

const isInfoConfirmed = (user: AddUserData) =>
  !!(user.name && user.email && user.username);

const handleInsertError = async (
  error: Error,
  req: FastifyRequest,
  con: DataSource | EntityManager,
  data: DeepPartial<User>,
  maxIterations = 5,
  iteration = 0,
): Promise<AddNewUserResult> => {
  req.log.error(
    {
      data,
      userId: data.id,
      error,
      iteration,
      maxIterations,
    },
    'failed to create user profile',
  );
  const shouldRetry = iteration < maxIterations;
  if ('code' in error) {
    // Unique
    if (error.code === TypeOrmError.DUPLICATE_ENTRY) {
      if (error.message.indexOf('users_username_unique') > -1) {
        return {
          status: 'failed',
          reason: UserFailErrorKeys.UsernameEmailExists,
        };
      }

      if (error.message.indexOf('PK_') > -1) {
        counters?.api?.userIdConflict?.add(1);
        if (shouldRetry) {
          data.id = await generateTrackingId(req, 'user creation');
          return safeInsertUser(req, con, data, maxIterations, iteration + 1);
        }
        return { status: 'failed', reason: UserFailErrorKeys.UserExists };
      }

      // If it's not username or primary key than it's twitter and github.
      if (shouldRetry) {
        if (error.message.indexOf('users_twitter_unique') > -1) {
          data.twitter = undefined;
        } else if (error.message.indexOf('users_github_unique') > -1) {
          data.github = undefined;
        }
        return safeInsertUser(req, con, data, maxIterations, iteration + 1);
      }
    }
  }

  throw error;
};

const safeInsertUser = async (
  req: FastifyRequest,
  con: DataSource | EntityManager,
  data: DeepPartial<User>,
  maxIterations = 5,
  iteration = 0,
): Promise<AddNewUserResult> => {
  try {
    await con.transaction(async (entityManager) => {
      const newUser = await entityManager.getRepository(User).insert(data);
      const newUserId = newUser.identifiers[0].id;
      const feedId = newUserId;

      await entityManager.getRepository(Feed).upsert(
        {
          userId: newUserId,
          id: feedId,
        },
        {
          conflictPaths: {
            id: true,
          },
        },
      );
    });

    req.log.info(`Created profile for user with ID: ${data.id}`);
    return { status: 'ok', userId: data.id as string };
  } catch (originalError) {
    const error = originalError as Error;

    return handleInsertError(error, req, con, data, maxIterations, iteration);
  }
};

export const addNewUser = async (
  con: DataSource,
  data: AddUserData,
  req: FastifyRequest,
): Promise<AddNewUserResult> => {
  if (!checkRequiredFields(data)) {
    req.log.info({ data }, 'missing fields when adding new user');
    return { status: 'failed', reason: UserFailErrorKeys.MissingFields };
  }

  const isEmailAvailable = await checkEmail(con, data.email);
  if (!isEmailAvailable) {
    return {
      status: 'failed',
      reason: UserFailErrorKeys.UsernameEmailExists,
    };
  }

  try {
    return safeInsertUser(req, con, {
      id: data.id,
      name: data.name,
      image: data.image ?? fallbackImages.avatar,
      username: data.username
        ? await validateAndTransformHandle(data.username, 'username', con)
        : undefined,
      email: data.email.toLowerCase(),
      profileConfirmed: data.profileConfirmed,
      infoConfirmed: isInfoConfirmed(data),
      createdAt: data.createdAt,
      referralId: data.referralId,
      referralOrigin: data.referralOrigin,
      acceptedMarketing: data.acceptedMarketing,
      timezone: data.timezone || DEFAULT_TIMEZONE,
      weekStart: DEFAULT_WEEK_START,
      github: data.github,
      twitter: data.twitter,
      experienceLevel: data.experienceLevel,
      language: data.language,
      flags: {
        trustScore: 1,
        vordr: false,
      },
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return {
        status: 'failed',
        reason: UserFailErrorKeys.UsernameEmailExists,
      };
    }
    throw error;
  }
};

export const validateUserUpdate = async (
  user: User,
  data: GQLUpdateUserInput,
  entityManager: DataSource | EntityManager,
): Promise<GQLUpdateUserInput> => {
  const { email, username } = data;
  if (email && email !== user.email) {
    const isEmailAvailable = await checkEmail(entityManager, email, user.id);
    if (!isEmailAvailable) {
      throw new ValidationError(
        JSON.stringify({ email: 'email is already used' }),
      );
    }
  }

  if (('username' in data && username !== user.username) || !user.username) {
    data.username = await validateAndTransformHandle(
      username,
      'username',
      entityManager,
    );
  }

  if ('timezone' in data) {
    const isValidTimeZone = validateValidTimeZone(data.timezone);
    if (!isValidTimeZone) {
      throw new ValidationError(
        JSON.stringify({ timezone: 'invalid timezone' }),
      );
    }
  }

  if (!checkLanguage(data.language)) {
    throw new ValidationError(JSON.stringify({ language: 'invalid language' }));
  }

  (
    ['name', 'twitter', 'github', 'hashnode'] as (keyof Pick<
      GQLUpdateUserInput,
      'name' | 'twitter' | 'github' | 'hashnode'
    >)[]
  ).forEach((key) => {
    if (data[key]) {
      data[key] = data[key].replace('@', '').trim();
    }
  });

  if ((data.portfolio?.length || 0) >= portfolioLimit) {
    throw new ValidationError('portfolio length is too long');
  }

  const regexParams: ValidateRegex[] = [
    ['name', data.name, nameRegex, !user.name],
    ['github', data.github, githubSocialUrlMatch],
    ['twitter', data.twitter, twitterSocialUrlMatch],
    ['hashnode', data.hashnode, socialUrlMatch],
    ['roadmap', data.roadmap, roadmapShSocialUrlMatch],
    ['threads', data.threads, threadsSocialUrlMatch],
    ['codepen', data.codepen, codepenSocialUrlMatch],
    ['reddit', data.reddit, redditSocialUrlMatch],
    ['stackoverflow', data.stackoverflow, stackoverflowSocialUrlMatch],
    ['youtube', data.youtube, youtubeSocialUrlMatch],
    ['linkedin', data.linkedin, linkedinSocialUrlMatch],
    ['mastodon', data.mastodon, mastodonSocialUrlMatch],
    ['portfolio', data.portfolio, socialUrlMatch],
  ];

  try {
    return validateRegex(regexParams, data);
  } catch (originalError) {
    if (originalError instanceof ValidationError) {
      const validationError: ValidationError = originalError;

      logger.warn(
        {
          errors: safeJSONParse(validationError.message) || {},
        },
        'social handles validation error',
      );
    }

    throw originalError;
  }
};
