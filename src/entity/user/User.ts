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
import {
  socialHandleRegex,
  nameRegex,
  validateRegex,
  ValidateRegex,
} from '../../common/object';
import { generateTrackingId } from '../../ids';

@Entity()
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

  @Column({ type: 'text', nullable: true })
  portfolio?: string;

  @Column({ length: 39, nullable: true })
  @Index('users_hashnode_unique', { unique: true })
  hashnode?: string;

  @Column({ default: false })
  devcardEligible: boolean;

  @Column({ type: 'text', nullable: true })
  timezone?: string;

  @Column({ type: 'boolean', default: false })
  @Index('IDX_user_profileConfirmed')
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

  @ManyToOne(() => User, {
    lazy: true,
    onDelete: 'SET NULL',
  })
  referral?: Promise<User>;

  @OneToMany(() => Post, (post) => post.author, { lazy: true })
  posts: Promise<Post[]>;

  @OneToMany(() => DevCard, (devcard) => devcard.user, { lazy: true })
  devCards: Promise<DevCard[]>;

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
>;
export type AddUserDataPost = { referral: string } & AddUserData;
export type UpdateUserEmailData = Pick<User, 'id' | 'email'>;
type AddNewUserResult =
  | { status: 'ok'; userId: string }
  | { status: 'failed'; reason: UserFailErrorKeys; error?: Error };

const checkRequiredFields = (data: AddUserData): boolean => {
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
    .where({ email: email.toLowerCase() });
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

  return con.transaction(async (entityManager) => {
    try {
      const res = await entityManager
        .getRepository(User)
        .update({ id: data.id }, { email: data.email });
      if (res.affected === 0) {
        logger.info(
          `Failed to update email user not found with ID: ${data.id}`,
        );
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
  });
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
        if (req.meter) {
          req.meter
            .createCounter('user_id_conflict', {
              description:
                'How many times a user id conflict happened on registration',
            })
            .add(1);
        }
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
      email: data.email,
      profileConfirmed: data.profileConfirmed,
      infoConfirmed: isInfoConfirmed(data),
      createdAt: data.createdAt,
      referralId: data.referralId,
      referralOrigin: data.referralOrigin,
      acceptedMarketing: data.acceptedMarketing,
      timezone: data.timezone,
      github: data.github,
      twitter: data.twitter,
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

  if ((username && username !== user.username) || !user.username) {
    data.username = await validateAndTransformHandle(
      username,
      'username',
      entityManager,
    );
  }

  ['name', 'twitter', 'github', 'hashnode'].forEach((key) => {
    if (data[key]) {
      data[key] = data[key].replace('@', '').trim();
    }
  });

  const regexParams: ValidateRegex[] = [
    ['name', data.name, nameRegex, !user.name],
    ['github', data.github, socialHandleRegex],
    ['twitter', data.twitter, new RegExp(/^@?(\w){1,15}$/)],
    ['hashnode', data.hashnode, socialHandleRegex],
  ];

  validateRegex(regexParams);

  return data;
};
