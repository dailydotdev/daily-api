import {
  AfterLoad,
  Column,
  Connection,
  Entity,
  EntityManager,
  Index,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import { Post } from './Post';
import { DevCard } from './DevCard';
import { FastifyLoggerInstance } from 'fastify';
import { UpdateUserFailErrorKeys, UserFailErrorKeys } from '../errors';
import { fallbackImages } from '../config';

@Entity()
export class User {
  @PrimaryColumn({ length: 36 })
  id: string;

  @Column({ type: 'text', nullable: true })
  name: string;

  @Column({ type: 'text', nullable: true })
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

  @Column({ nullable: true })
  @Index('IDX_user_createdAt')
  createdAt?: Date;

  @Column({ nullable: true })
  updatedAt?: Date;

  @Column({ type: 'text', nullable: true })
  referral?: string;

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
  | 'referral'
  | 'infoConfirmed'
  | 'profileConfirmed'
  | 'acceptedMarketing'
>;
export type UpdateUserEmailData = Pick<User, 'id' | 'email'>;
type AddNewUserResult =
  | { status: 'ok'; userId: string }
  | { status: 'failed'; reason: UserFailErrorKeys; error?: Error };

const checkRequiredFields = (data: AddUserData): boolean => {
  return !!(data && data.id);
};

const checkUsernameAndEmail = async (
  entityManager: EntityManager,
  data: AddUserData,
): Promise<boolean> => {
  const { email, username } = data;
  const user = await entityManager
    .getRepository(User)
    .createQueryBuilder()
    .select('id')
    .where('email = :email or username = :username', {
      email,
      username,
    })
    .getRawOne();
  return !user;
};

type UpdateUserEmailResult =
  | { status: 'ok'; userId: string }
  | { status: 'failed'; reason: UpdateUserFailErrorKeys; error?: Error };
export const updateUserEmail = async (
  con: Connection,
  data: UpdateUserEmailData,
  logger: FastifyLoggerInstance,
): Promise<UpdateUserEmailResult> => {
  if (!data.email || !data.id) {
    return { status: 'failed', reason: 'MISSING_FIELDS' };
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
        return { status: 'failed', reason: 'USER_DOESNT_EXIST' };
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
  con: Connection,
  data: AddUserData,
  logger: FastifyLoggerInstance,
): Promise<AddNewUserResult> => {
  if (!checkRequiredFields(data)) {
    logger.info({ data }, 'missing fields when adding new user');
    return { status: 'failed', reason: 'MISSING_FIELDS' };
  }

  return con.transaction(async (entityManager) => {
    const isUniqueUser = await checkUsernameAndEmail(entityManager, data);
    if (!isUniqueUser) {
      return { status: 'failed', reason: 'USERNAME_EMAIL_EXISTS' };
    }

    try {
      await entityManager.getRepository(User).insert({
        id: data.id,
        name: data.name,
        image: data.image ?? fallbackImages.avatar,
        username: data.username,
        email: data.email,
        profileConfirmed: data.profileConfirmed,
        infoConfirmed: isInfoConfirmed(data),
        createdAt: data.createdAt,
        referral: data.referral,
        acceptedMarketing: data.acceptedMarketing,
        ...(data?.github && { github: data.github }),
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

      // Unique
      if (error?.code === '23505') {
        return { status: 'failed', reason: 'USER_EXISTS' };
      }

      throw error;
    }
  });
};
