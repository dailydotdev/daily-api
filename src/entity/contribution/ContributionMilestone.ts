import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
@Index('IDX_contribution_milestone_value', ['value'], { unique: true })
export class ContributionMilestone {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_contribution_milestone_id',
  })
  id: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  // The lifetime approved-points threshold this milestone represents.
  @Column({ type: 'integer' })
  value: number;

  @Column({ type: 'text', nullable: true, default: null })
  title: string | null;

  // Stamped once when the global lifetime points cross this threshold.
  @Column({ type: 'timestamptz', nullable: true, default: null })
  reachedAt: Date | null;
}
