import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import { randomBytes } from 'crypto';
import { Source } from './Source';
import { User } from './User';
import { promisify } from 'util';

const randomBytesAsync = promisify(randomBytes);

export enum SourceMemberRoles {
  Owner = 'owner',
  Moderator = 'moderator',
  Member = 'member',
}

export const roleRank: Record<SourceMemberRoles, number> = {
  owner: 10,
  moderator: 1,
  member: 0,
};

@Entity()
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
}

const TOKEN_BYTES = 32;
export const generateMemberToken = async (): Promise<string> =>
  (await randomBytesAsync(TOKEN_BYTES)).toString('base64url');
