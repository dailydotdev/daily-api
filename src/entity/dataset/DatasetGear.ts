import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
@Index('IDX_dataset_gear_name_normalized_unique', ['nameNormalized'], {
  unique: true,
})
@Index('IDX_dataset_gear_name_trgm', { synchronize: false })
export class DatasetGear {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_dataset_gear_id',
  })
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text' })
  nameNormalized: string;

  @Column({ type: 'timestamp', default: () => 'now()' })
  createdAt: Date;
}
