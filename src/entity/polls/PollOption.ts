import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Post } from '../posts';
import type { UserPost } from '../user';

@Entity()
export class PollOption {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_Poll_Option_Id',
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
    foreignKeyConstraintName: 'FK_Poll_Option_Post_Id',
  })
  post: Promise<Post>;

  @OneToMany('UserPost', (up: UserPost) => up.pollVoteOption, {
    lazy: true,
  })
  userPosts: Promise<UserPost[]>;

  @Column({ type: 'integer', default: 0 })
  numVotes: number;
}
