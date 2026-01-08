import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
@Index(
  'IDX_location_country_subdivision_city_continent_unique',
  ['country', 'subdivision', 'city', 'continent'],
  { unique: true },
)
@Index('IDX_dataset_location_country_trgm', { synchronize: false })
@Index('IDX_dataset_location_city_trgm', { synchronize: false })
@Index('IDX_dataset_location_subdivision_trgm', { synchronize: false })
@Index('IDX_dataset_location_continent_trgm', { synchronize: false })
export class DatasetLocation {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_dataset_location_id',
  })
  id: string;

  @Column({ nullable: true })
  country: string;

  @Column({ nullable: true })
  continent: string;

  @Column({ type: 'text', nullable: true })
  subdivision: string | null;

  @Column({ type: 'text', nullable: true })
  city: string | null;

  @Column({ nullable: true })
  @Index('IDX_dataset_location_iso2')
  iso2: string;

  @Column({ nullable: true })
  @Index('IDX_dataset_location_iso3')
  iso3: string;

  @Index('IDX_dataset_location_externalId')
  @Column({ type: 'text', nullable: true, unique: true })
  externalId: string | null;
}
