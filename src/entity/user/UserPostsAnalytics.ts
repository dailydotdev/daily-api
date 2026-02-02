import {
  Column,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  ViewColumn,
  ViewEntity,
} from 'typeorm';
import type { User } from './User';

@ViewEntity({
  name: 'user_posts_analytics',
  synchronize: false,
})
export class UserPostsAnalytics {
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
  profileViews: number;

  @ViewColumn()
  @Column({ default: 0 })
  followers: number;

  @ViewColumn()
  @Column({ default: 0 })
  squadJoins: number;

  @ViewColumn()
  @Column({ default: 0 })
  reputation: number;

  @ViewColumn()
  @Column({ default: 0 })
  coresEarned: number;

  @ViewColumn()
  @Column({ default: 0 })
  shares: number;

  @ViewColumn()
  @Column({ default: 0 })
  clicks: number;

  @ViewColumn()
  @Column()
  updatedAt: Date;

  @OneToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'id' })
  user: Promise<User>;
}
