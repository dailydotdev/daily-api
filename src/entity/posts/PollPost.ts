import { ChildEntity, Column, OneToMany } from 'typeorm';
import type { PollOption } from '../polls/PollOption';
import { Post, PostType } from './Post';

@ChildEntity(PostType.Poll)
export class PollPost extends Post {
  @OneToMany('PollOption', (option: PollOption) => option.post, {
    lazy: true,
  })
  pollOptions: Promise<PollOption[]>;

  @Column({ type: 'timestamp' })
  endsAt?: Date | null;

  @Column({ type: 'integer', default: 0 })
  numPollVotes: number;
}
