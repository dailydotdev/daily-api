import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import { Source } from './Source';
import { User } from './User';

export enum SourceMemberRoles {
  Owner = 'owner',
  Member = 'member',
}

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

  @Column({ type: 'uuid' })
  @Index('IDX_source_member_referralToken', { unique: true })
  referralToken: string;
}
