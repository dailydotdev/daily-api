import {
  AfterLoad,
  Column,
  DataSource,
  Entity,
  EntityManager,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import { Post } from './posts';
import { DevCard } from './DevCard';
import { FastifyBaseLogger } from 'fastify';
import {
  TypeOrmError,
  UpdateUserFailErrorKeys,
  UserFailErrorKeys,
} from '../errors';
import { fallbackImages } from '../config';
import { validateAndTransformHandle } from '../common/handles';
import { ValidationError } from 'apollo-server-errors';
import { GQLUpdateUserInput } from '../schema/users';
import {
  socialHandleRegex,
  nameRegex,
  validateRegex,
  ValidateRegex,
} from '../common/object';

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

  @Column({ default: false })
  @Index('IDX_user_profileConfirmed')
  profileConfirmed: boolean | null;

  @Column({ nullable: false, default: () => 'now()' })
  @Index('IDX_user_createdAt')
  createdAt?: Date;

  @Column({ nullable: true })
  updatedAt?: Date;

  @Column({ length: 36, nullable: true })
  @Index('IDX_user_referral')
  referralId?: string | null;

  @Column({ type: 'text', nullable: true })
  @Index('IDX_user_referral_origin')
  referralOrigin?: string | null;

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

const checkGitHubHandle = async (
  entityManager: EntityManager,
  github: string,
): Promise<boolean> => {
  const user = await entityManager
    .getRepository(User)
    .createQueryBuilder()
    .select('id')
    .where({ github })
    .getRawOne();
  return !user;
};

const checkTwitterHandle = async (
  entityManager: EntityManager,
  twitter: string,
): Promise<boolean> => {
  const user = await entityManager
    .getRepository(User)
    .createQueryBuilder()
    .select('id')
    .where({ twitter })
    .getRawOne();
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

export const addNewUser = async (
  con: DataSource,
  data: AddUserData,
  logger: FastifyBaseLogger,
): Promise<AddNewUserResult> => {
  if (!checkRequiredFields(data)) {
    logger.info({ data }, 'missing fields when adding new user');
    return { status: 'failed', reason: UserFailErrorKeys.MissingFields };
  }

  return con.transaction(async (entityManager) => {
    const isEmailAvailable = await checkEmail(entityManager, data.email);
    if (!isEmailAvailable) {
      return {
        status: 'failed',
        reason: UserFailErrorKeys.UsernameEmailExists,
      };
    }

    // Clear GitHub handle in case it already exists
    let github = data.github;
    if (github) {
      const isGitHubAvailable = await checkGitHubHandle(entityManager, github);
      if (!isGitHubAvailable) {
        github = null;
      }
    }

    // Clear Twitter handle in case it already exists
    let twitter = data.twitter;
    if (twitter) {
      const isTwitterAvailable = await checkTwitterHandle(
        entityManager,
        twitter,
      );
      if (!isTwitterAvailable) {
        twitter = null;
      }
    }

    try {
      await entityManager.getRepository(User).insert({
        id: data.id,
        name: data.name,
        image: data.image ?? fallbackImages.avatar,
        username: data.username
          ? await validateAndTransformHandle(
              data.username,
              'username',
              entityManager,
            )
          : undefined,
        email: data.email,
        profileConfirmed: data.profileConfirmed,
        infoConfirmed: isInfoConfirmed(data),
        createdAt: data.createdAt,
        referralId: data.referralId,
        referralOrigin: data.referralOrigin,
        acceptedMarketing: data.acceptedMarketing,
        timezone: data.timezone,
        github,
        twitter,
      });

      logger.info(`Created profile for user with ID: ${data.id}`);
      return { status: 'ok', userId: data.id };
    } catch (error) {
      logger.error(
        {
          data,
          userId: data.id,
          error,
        },
        'failed to create user profile',
      );
      if (error instanceof ValidationError) {
        return {
          status: 'failed',
          reason: UserFailErrorKeys.UsernameEmailExists,
        };
      }
      // Unique
      if (error?.code === TypeOrmError.DUPLICATE_ENTRY) {
        if (error.message.indexOf('users_username_unique') > -1) {
          return {
            status: 'failed',
            reason: UserFailErrorKeys.UsernameEmailExists,
          };
        }
        return { status: 'failed', reason: UserFailErrorKeys.UserExists };
      }

      throw error;
    }
  });
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
