import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
@Index(
  'IDX_location_country_subdivision_city_unique',
  ['country', 'subdivision', 'city'],
  { unique: true },
)
@Index('IDX_dataset_location_country_trgm', { synchronize: false })
@Index('IDX_dataset_location_city_trgm', { synchronize: false })
@Index('IDX_dataset_location_subdivision_trgm', { synchronize: false })
@Index('IDX_dataset_location_iso2_trgm', { synchronize: false })
@Index('IDX_dataset_location_iso3_trgm', { synchronize: false })
export class DatasetLocation {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_dataset_location_id',
  })
  id: string;

  @Column()
  country: string;

  @Column({ type: 'text', nullable: true })
  subdivision: string | null;

  @Column({ type: 'text', nullable: true })
  city: string | null;

  @Column()
  iso2: string;

  @Column()
  iso3: string;

  @Column()
  timezone: string;

  @Column({ default: 0 })
  ranking: number;

  @Column({ type: 'text', nullable: true })
  externalId: string | null;
}
