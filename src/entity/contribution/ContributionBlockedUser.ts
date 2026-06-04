import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import type { User } from '../user/User';

@Entity()
export class ContributionBlockedUser {
  @PrimaryColumn({
    length: 36,
    primaryKeyConstraintName: 'PK_contribution_blocked_user',
  })
  userId: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'text', nullable: true, default: null })
  reason: string | null;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_contribution_blocked_user_user_id',
  })
  user: Promise<User>;
}
