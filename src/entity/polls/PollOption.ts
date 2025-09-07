import {
  Column,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Post } from '../posts';
import type { UserPost } from '../user';

@Entity()
export class PollOption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'integer' })
  order: number;

  @Index('poll_option_post_id_index')
  @Column({ type: 'uuid' })
  postId: string;

  @ManyToOne('Post', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  post: Promise<Post>;

  @OneToMany('UserPost', (up: UserPost) => up.pollVoteOption, {
    lazy: true,
  })
  userPosts: Promise<UserPost[]>;

  @Column({ type: 'integer', default: 0 })
  numVotes: number;
}
