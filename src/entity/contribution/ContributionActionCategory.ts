import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
@Index('IDX_contribution_action_category_active_sort', [
  'active',
  'sortOrder',
  'createdAt',
])
export class ContributionActionCategory {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_contribution_action_category_id',
  })
  id: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'integer', default: 0 })
  sortOrder: number;
}
