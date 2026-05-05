import { Column, Entity, Index, OneToMany, PrimaryColumn } from 'typeorm';
import type { ArchiveItem } from './ArchiveItem';
import type {
  ArchivePeriodType,
  ArchiveRankingType,
  ArchiveScopeType,
  ArchiveSubjectType,
} from '../common/archive';

@Entity()
@Index('IDX_archive_lookup_unique', { synchronize: false })
@Index('IDX_archive_lookup', [
  'subjectType',
  'rankingType',
  'scopeType',
  'scopeId',
  'periodType',
  'periodStart',
])
export class Archive {
  @PrimaryColumn({ type: 'uuid', default: () => 'uuid_generate_v4()' })
  id: string;

  @Column({ type: 'text' })
  subjectType: ArchiveSubjectType;

  @Column({ type: 'text' })
  rankingType: ArchiveRankingType;

  @Column({ type: 'text' })
  scopeType: ArchiveScopeType;

  @Column({ type: 'text', nullable: true })
  scopeId: string | null;

  @Column({ type: 'text' })
  periodType: ArchivePeriodType;

  @Column({ type: 'timestamptz' })
  periodStart: Date;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @OneToMany('ArchiveItem', (item: ArchiveItem) => item.archive, {
    lazy: true,
  })
  items: Promise<ArchiveItem[]>;
}
