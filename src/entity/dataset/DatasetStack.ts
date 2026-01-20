import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
@Index('IDX_dataset_stack_title_normalized_unique', ['titleNormalized'], {
  unique: true,
})
@Index('IDX_dataset_stack_title_trgm', { synchronize: false })
export class DatasetStack {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_dataset_stack_id',
  })
  id: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  titleNormalized: string;

  @Column({ type: 'text', nullable: true })
  icon: string | null;

  @Column({ type: 'timestamp', default: () => 'now()' })
  createdAt: Date;
}
