import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { UserPost } from '../user/UserPost';
import type { Post } from '../posts/Post';

@Entity()
export class PollOption {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_poll_option_id',
  })
  id: string;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'integer' })
  order: number;

  @Index('IDX_poll_option_post_id_index')
  @Column({ type: 'uuid' })
  postId: string;

  @ManyToOne('Post', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'postId',
    foreignKeyConstraintName: 'FK_poll_option_post_id',
  })
  post: Promise<Post>;

  @OneToMany('UserPost', (up: UserPost) => up.pollVoteOption, {
    lazy: true,
  })
  userPosts: Promise<UserPost[]>;

  @Column({ type: 'integer', default: 0 })
  numVotes: number;
}
