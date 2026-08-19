import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum LedgerEntityKind {
  Package = 'package',
  Model = 'model',
  Api = 'api',
  Spec = 'spec',
  Service = 'service',
  Tool = 'tool',
  Runtime = 'runtime',
  Other = 'other',
  Concept = 'concept',
}

@Entity()
// Unique on lower("canonicalName"), a GIN index over the normalized lookup
// names and a trigram index for near-miss matching, all created in the
// migration since TypeORM cannot express any of them.
@Index('UQ_ledger_entity_canonical_name_lower', { synchronize: false })
@Index('IDX_ledger_entity_search_names', { synchronize: false })
@Index('IDX_ledger_entity_canonical_name_trgm', { synchronize: false })
@Index('IDX_ledger_entity_parentId', ['parentId'])
export class LedgerEntity {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_ledger_entity_id',
  })
  id: string;

  @Column({ type: 'text' })
  canonicalName: string;

  @Column({ type: 'text' })
  kind: LedgerEntityKind;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  aliases: string[];

  // Soft reference to keyword.value, matching how post_keyword references it.
  @Column({ type: 'text', nullable: true, default: null })
  keywordValue: string | null;

  @Column({ type: 'uuid', nullable: true, default: null })
  parentId: string | null;

  @ManyToOne('LedgerEntity', {
    lazy: true,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'parentId',
    foreignKeyConstraintName: 'FK_ledger_entity_parent_id',
  })
  parent: Promise<LedgerEntity | null>;
}
