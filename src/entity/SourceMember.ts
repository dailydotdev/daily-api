import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import { randomBytes } from 'crypto';
import { Source } from './Source';
import { User } from './user';
import { promisify } from 'util';
import { SourceMemberRoles } from '../roles';

const randomBytesAsync = promisify(randomBytes);

export type SourceMemberFlags = Partial<{
  hideFeedPosts: boolean;
  collapsePinnedPosts: boolean;
}>;

export type SourceMemberFlagsPublic = Pick<
  SourceMemberFlags,
  'hideFeedPosts' | 'collapsePinnedPosts'
>;

@Entity()
@Index('IDX_source_member_userId_role', ['userId', 'role'])
@Index('IDX_source_member_sourceId_role', ['sourceId', 'role'])
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
