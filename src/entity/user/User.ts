import {
  AfterLoad,
  Column,
  DataSource,
  DeepPartial,
  Entity,
  EntityManager,
  Index,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';
import { Post } from '../posts';
import { DevCard } from '../DevCard';
import { FastifyBaseLogger, FastifyRequest } from 'fastify';
import {
  TypeOrmError,
  UpdateUserFailErrorKeys,
  UserFailErrorKeys,
} from '../../errors';
import { fallbackImages } from '../../config';
import { validateAndTransformHandle } from '../../common/handles';
import { ValidationError } from 'apollo-server-errors';
import { GQLUpdateUserInput } from '../../schema/users';
import { nameRegex, validateRegex, ValidateRegex } from '../../common/object';
import { generateTrackingId } from '../../ids';
import { UserStreak } from './UserStreak';
import { validateValidTimeZone } from '../../common/timezone';
import { counters } from '../../telemetry';
import {
  codepenSocialUrlMatch,
  githubSocialUrlMatch,
  linkedinSocialUrlMatch,
  mastodonSocialUrlMatch,
  portfolioLimit,
  redditSocialUrlMatch,
  roadmapShSocialUrlMatch,
  socialUrlMatch,
  stackoverflowSocialUrlMatch,
  threadsSocialUrlMatch,
  twitterSocialUrlMatch,
  youtubeSocialUrlMatch,
} from '../../common/users';
import { logger } from '../../logger';
import {
  DayOfWeek,
  DEFAULT_TIMEZONE,
  DEFAULT_WEEK_START,
  safeJSONParse,
} from '../../common';

export type UserFlags = Partial<{
  vordr: boolean;
  trustScore: number;
}>;

@Entity()
@Index('IDX_user_lowerusername_username', { synchronize: false })
@Index('IDX_user_lowertwitter', { synchronize: false })
@Index('IDX_user_loweremail', { synchronize: false })
@Index('IDX_user_gin_username', { synchronize: false })
@Index('IDX_user_gin_name', { synchronize: false })
export class User {
  @PrimaryColumn({ length: 36 })
  id: string;

  @Column({ type: 'text', nullable: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  @Index('IDX_user_email')
  email: string;

  @Column({ type: 'text', nullable: true })
  image: string;

  @Column({ type: 'text', nullable: true })
  cover?: string;

  @Column({ type: 'text', nullable: true })
  company?: string;

  @Column({ type: 'text', nullable: true })
  title?: string;

  @Column({ default: false })
  infoConfirmed: boolean;

  @Column({ default: false })
  acceptedMarketing: boolean;

  @Column({ default: true })
  notificationEmail: boolean;

  @Column({ default: 10 })
  reputation: number;

  @Column({ length: 39, nullable: true })
  @Index('users_username_unique', { unique: true })
  username?: string;

  @Column({ type: 'text', nullable: true })
  bio?: string;

  @Column({ length: 15, nullable: true })
  @Index('users_twitter_unique', { unique: true })
  twitter?: string;

  @Column({ length: 39, nullable: true })
  @Index('users_github_unique', { unique: true })
  github?: string;

  @Column({ length: 39, nullable: true })
  @Index('users_roadmap_unique', { unique: true })
  roadmap?: string;

  @Column({ length: 39, nullable: true })
  @Index('users_threads_unique', { unique: true })
  threads?: string;

  @Column({ length: 39, nullable: true })
  @Index('users_codepen_unique', { unique: true })
  codepen?: string;

  @Column({ length: 39, nullable: true })
  @Index('users_reddit_unique', { unique: true })
  reddit?: string;

  @Column({ length: 100, nullable: true })
  @Index('users_stackoverflow_unique', { unique: true })
  stackoverflow?: string;

  @Column({ length: 39, nullable: true })
  @Index('users_youtube_unique', { unique: true })
  youtube?: string;

  @Column({ length: 39, nullable: true })
  @Index('users_linkedin_unique', { unique: true })
  linkedin?: string;

  @Column({ length: 100, nullable: true })
  @Index('users_mastodon_unique', { unique: true })
  mastodon?: string;

  @Column({ type: 'text', nullable: true })
  portfolio?: string;

  @Column({ length: 39, nullable: true })
  @Index('users_hashnode_unique', { unique: true })
  hashnode?: string;

  @Column({ default: false })
  devcardEligible: boolean;

  @Column({ type: 'text', nullable: true, default: DEFAULT_TIMEZONE })
  timezone?: string;

  @Column({ type: 'int', nullable: true, default: DEFAULT_WEEK_START })
  weekStart?: DayOfWeek;

  @Column({ type: 'boolean', default: false })
  profileConfirmed: boolean | null;

  @Column({ nullable: false, default: () => 'now()' })
  @Index('IDX_user_createdAt')
  createdAt: Date;

  @Column({ nullable: true })
  updatedAt?: Date;

  @Column({ length: 36, nullable: true })
  @Index('IDX_user_referral')
  referralId?: string | null;

  @Column({ type: 'text', nullable: true })
  @Index('IDX_user_referral_origin')
  referralOrigin?: string | null;

  @Column({ type: 'text', nullable: true })
  readme?: string;

  @Column({ type: 'text', nullable: true })
  readmeHtml?: string;

  @Column({ type: 'text', nullable: true })
  acquisitionChannel: string;

  @Column({ type: 'text', nullable: true })
  experienceLevel: string | null;

  @Column({ type: 'jsonb', default: {} })
  @Index('IDX_user_flags_vordr', { synchronize: false })
  flags: UserFlags;

  @ManyToOne(() => User, {
    lazy: true,
    onDelete: 'SET NULL',
  })
  referral?: Promise<User>;

  @OneToMany(() => Post, (post) => post.author, { lazy: true })
  posts: Promise<Post[]>;

  @OneToMany(() => DevCard, (devcard) => devcard.user, { lazy: true })
  devCards: Promise<DevCard[]>;

  @OneToOne(() => UserStreak, (streak) => streak.user, {
    lazy: true,
    onDelete: 'SET NULL',
  })
  streak: Promise<UserStreak>;

  permalink: string;

  @AfterLoad()
  setComputed() {
    this.permalink = `${process.env.COMMENTS_PREFIX}/${
      this.username ?? this.id
    }`;
  }
}

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
>;
export type AddUserDataPost = { referral: string } & AddUserData;
export type UpdateUserEmailData = Pick<User, 'id' | 'email'>;
type AddNewUserResult =
  | { status: 'ok'; userId: string }
  | { status: 'failed'; reason: UserFailErrorKeys; error?: Error };

const checkRequiredFields = (data: AddUserData): boolean => {
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
          data.twitter = null;
        } else if (error.message.indexOf('users_github_unique') > -1) {
          data.github = null;
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
    await con.getRepository(User).insert(data);
    req.log.info(`Created profile for user with ID: ${data.id}`);
    return { status: 'ok', userId: data.id };
  } catch (error) {
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

  ['name', 'twitter', 'github', 'hashnode'].forEach((key) => {
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
    const validatedData = validateRegex(regexParams, data);

    return validatedData;
  } catch (originalError) {
    if (originalError instanceof ValidationError) {
      const validationError = originalError as ValidationError;

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
