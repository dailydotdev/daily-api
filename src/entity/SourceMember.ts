import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import { randomBytes } from 'crypto';
import { Source } from './Source';
import { User } from './User';
import { promisify } from 'util';
import { SourceMemberRoles } from '../roles';

const randomBytesAsync = promisify(randomBytes);

export type SourceMemberFlags = Partial<{
  showPostsOnFeed: boolean;
}>;

export type SourceMemberFlagsPublic = Pick<
  SourceMemberFlags,
  'showPostsOnFeed'
>;

@Entity()
@Index('IDX_source_member_userId_flags_showPostsOnFeed', { synchronize: false })
export class SourceMember {
  @PrimaryColumn({ type: 'text' })
  @Index('IDX_source_member_sourceId')
  sourceId: string;

  @ManyToOne(() => Source, (source) => source.members, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  source: Promise<Source>;

  @PrimaryColumn({ length: 36 })
  @Index('IDX_source_member_userId')
  userId: string;

  @ManyToOne(() => User, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'text' })
  role: SourceMemberRoles;

  @Column({ type: 'text' })
  @Index('IDX_source_member_referralToken', { unique: true })
  referralToken: string;

  @Column({ type: 'jsonb', default: {} })
  flags: SourceMemberFlags;
}

const TOKEN_BYTES = 32;
export const generateMemberToken = async (): Promise<string> =>
  (await randomBytesAsync(TOKEN_BYTES)).toString('base64url');
