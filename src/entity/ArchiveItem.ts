import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import type { Archive } from './Archive';

@Entity()
@Index('IDX_archive_item_archive_id_rank', ['archiveId', 'rank'], {
  unique: true,
})
@Index('IDX_archive_item_archive_id_subject_id', ['archiveId', 'subjectId'], {
  unique: true,
})
export class ArchiveItem {
  @PrimaryColumn({ type: 'uuid' })
  archiveId: string;

  @PrimaryColumn({ type: 'text' })
  subjectId: string;

  @Column({ type: 'integer' })
  rank: number;

  @ManyToOne('Archive', (archive: Archive) => archive.items, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'archiveId', referencedColumnName: 'id' })
  archive: Promise<Archive>;
}
