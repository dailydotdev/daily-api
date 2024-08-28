import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import type { User } from './user';

export type FeedFlags = Partial<{
  name: string;
}>;

export type FeedFlagsPublic = Pick<FeedFlags, 'name'>;

@Entity()
@Index('IDX_feed_id_user_id', ['id', 'userId'], { unique: true })
export class Feed {
  @PrimaryColumn({ type: 'text' })
  id: string;

  @Column({ type: 'text' })
  @Index()
  userId: string;

  @Column({ default: () => 'now()', update: false })
  createdAt: Date;

  @Column({ type: 'jsonb', default: {} })
  flags: FeedFlags = {};

  @Column({
    type: 'text',
    update: false,
    insert: false,
    nullable: false,
    unique: true,
    generatedType: 'STORED',
    asExpression: `trim(BOTH '-' FROM regexp_replace(lower(trim(COALESCE(LEFT(feed.flags->>'name',100),'')||'-'||feed.id)), '[^a-z0-9-]+', '-', 'gi'))`,
  })
  @Index('IDX_feed_slug', { unique: true })
  slug: string;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;
}
