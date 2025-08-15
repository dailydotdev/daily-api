import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Post } from './Post';

@Entity()
export class PostAnalytics {
  @PrimaryColumn({ type: 'text' })
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ default: 0 })
  impressions: number;

  @Column({ default: 0 })
  reach: number;

  @Column({ default: 0 })
  bookmarks: number;

  @Column({ default: 0 })
  profileViews: number;

  @Column({ default: 0 })
  followers: number;

  @Column({ default: 0 })
  squadJoins: number;

  @Column({ default: 0 })
  sharesExternal: number;

  @Column({ default: 0 })
  sharesInternal: number;

  @Column({ default: 0 })
  reputation: number;

  @Column({ default: 0 })
  coresEarned: number;

  @Column({ default: 0 })
  upvotes: number;

  @Column({ default: 0 })
  downvotes: number;

  @Column({ default: 0 })
  comments: number;

  @Column({ default: 0 })
  awards: number;

  //  not added to migration because raw events data has some invalid post ids
  @OneToOne('Post', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'id' })
  post: Promise<Post>;
}
