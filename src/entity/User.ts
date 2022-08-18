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
import { UserFailErrorKeys } from '../errors';

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
  @Index()
  username?: string;

  @Column({ type: 'text', nullable: true })
  bio?: string;

  @Column({ length: 15, nullable: true })
  @Index()
  twitter?: string;

  @Column({ length: 39, nullable: true })
  github?: string;

  @Column({ type: 'text', nullable: true })
  portfolio?: string;

  @Column({ length: 39, nullable: true })
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
  'id' | 'name' | 'image' | 'username' | 'email' | 'createdAt' | 'github'
>;
type AddNewUserResult =
  | { status: 'ok'; userId: string }
  | { status: 'failed'; reason: UserFailErrorKeys; error?: Error };

const checkRequiredFields = (data: AddUserData): boolean => {
  return !!(
    data &&
    data.id &&
    data.name &&
    data.image &&
    data.username &&
    data.email
  );
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

export const addNewUser = async (
  con: Connection,
  data: AddUserData,
  logger: FastifyLoggerInstance,
): Promise<AddNewUserResult> => {
  if (!checkRequiredFields(data)) {
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
        image: data.image,
        username: data.username,
        email: data.email,
        profileConfirmed: true,
        infoConfirmed: true,
        createdAt: data.createdAt,
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
