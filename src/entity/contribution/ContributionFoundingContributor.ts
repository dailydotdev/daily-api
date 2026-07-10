import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import type { User } from '../user/User';

// The first N contributors, awarded the founding-contributor award. Presence is
// the idempotency marker and the row count enforces the cap.
@Entity()
export class ContributionFoundingContributor {
  @PrimaryColumn({
    length: 36,
    primaryKeyConstraintName: 'PK_contribution_founding_contributor',
  })
  userId: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'uuid', nullable: true, default: null })
  transactionId: string | null;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_contribution_founding_contributor_user_id',
  })
  user: Promise<User>;
}
