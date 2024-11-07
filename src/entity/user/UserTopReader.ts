import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import type { User } from './User';
import type { Keyword } from '../Keyword';

@Entity()
@Index('IDX_user_top_reader_userId_issuedAt', { synchronize: false })
@Index(
  'IDX_user_top_reader_userId_issuedAt_keywordValue',
  ['userId', 'issuedAt', 'keywordValue'],
  { unique: true },
)
export class UserTopReader {
  @PrimaryColumn({ type: 'uuid', default: () => 'uuid_generate_v4()' })
  @Index('IDX_user_top_reader_id', { unique: true })
  id: string;

  @PrimaryColumn({ type: 'text' })
  userId: string;

  @Column({ type: 'timestamptz' })
  issuedAt: Date;

  @Column({ type: 'text' })
  keywordValue: string;

  @Column({ type: 'text', nullable: true })
  image: string;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;

  @ManyToOne('Keyword', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  keyword: Promise<Keyword>;
}
