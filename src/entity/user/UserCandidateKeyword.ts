import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import type { User } from './User';

@Entity()
export class UserCandidateKeyword {
  @PrimaryColumn({ type: 'text' })
  userId: string;

  @PrimaryColumn({ type: 'text' })
  keyword: string;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_user_candidate_keywork_user_id',
  })
  user: Promise<User>;
}
