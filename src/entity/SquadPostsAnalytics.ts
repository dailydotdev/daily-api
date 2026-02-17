import {
  Column,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  ViewColumn,
  ViewEntity,
} from 'typeorm';
import type { Source } from './Source';

@ViewEntity({
  name: 'squad_posts_analytics',
  synchronize: false,
})
export class SquadPostsAnalytics {
  @ViewColumn()
  @PrimaryColumn({ type: 'text' })
  id: string;

  @ViewColumn()
  @Column({ default: 0 })
  impressions: number;

  @ViewColumn()
  @Column({ default: 0 })
  reach: number;

  @ViewColumn()
  @Column({ default: 0 })
  reachAll: number;

  @ViewColumn()
  @Column({ default: 0 })
  upvotes: number;

  @ViewColumn()
  @Column({ default: 0 })
  downvotes: number;

  @ViewColumn()
  @Column({ default: 0 })
  comments: number;

  @ViewColumn()
  @Column({ default: 0 })
  bookmarks: number;

  @ViewColumn()
  @Column({ default: 0 })
  awards: number;

  @ViewColumn()
  @Column({ default: 0 })
  shares: number;

  @ViewColumn()
  @Column({ default: 0 })
  clicks: number;

  @ViewColumn()
  @Column()
  updatedAt: Date;

  @OneToOne('Source', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'id' })
  source: Promise<Source>;
}
