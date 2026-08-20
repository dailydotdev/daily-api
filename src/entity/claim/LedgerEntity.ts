import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { LEDGER_EMBEDDING_DIMENSION } from '../../common/ledgerEmbedding';

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

  // Registry names that double as ordinary English words (`requests`, `next`,
  // `node`). They answer name lookups exactly like aliases, but prose matching
  // in the rot detector must never see them — "handle requests from the next
  // page" names no package. The prose-ambiguity call is made once, here, when
  // the name is filed; every consumer inherits it.
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  codeOnlyAliases: string[];

  // What the entity is and, above all, what approach it displaced, written the
  // way someone would describe the problem before they knew this thing existed.
  // A plan that never names MCP still says "hand-rolled function-calling
  // adapter", and this is the only column that sentence can reach.
  @Column({ type: 'text', nullable: true, default: null })
  description: string | null;

  @Column({
    type: 'vector',
    length: LEDGER_EMBEDDING_DIMENSION,
    nullable: true,
    default: null,
    select: false,
  })
  descriptionEmbedding: number[] | null;

  // The model the vector came from, so a model change is detectable instead of
  // silently comparing two incompatible spaces.
  @Column({ type: 'text', nullable: true, default: null })
  descriptionEmbeddingModel: string | null;

  // Some entities are never worth describing as an operational call: nobody
  // plans "I need somewhere to host the repo" and means GitHub, so a
  // description would only ever answer the wrong prose. The ruling is kept as
  // the reason it was made, so the same names stop returning to the top of the
  // describe backlog every sweep and the next reviewer can see why.
  @Column({ type: 'text', nullable: true, default: null })
  descriptionSkipReason: string | null;

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
