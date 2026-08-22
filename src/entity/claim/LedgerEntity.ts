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

// The closed vocabulary of package REGISTRIES an entity can be installed from.
// Registries, not languages, because the registry is the thing an evidence URL
// and a coordinate actually name — and because one language can install from
// two (Kotlin from Maven, Dart from pub) while one registry serves several.
//
// This enum is THE list. rot-bench's detector carries the other half of the
// rule as a language -> registries map (`python -> {pypi}`, `javascript ->
// {npm}`, `go -> {go}`, `ruby -> {rubygems}`, `php -> {packagist}`, `elixir ->
// {hex}`, `rust -> {crates}`, `csharp -> {nuget}`, `dart -> {pub}`, `java`/
// `kotlin` -> `{maven}`), and smith and bragi send values from it when they
// file an entity. Adding a value here without the matching language on the
// detector side makes entities carrying it resolve from NO code token at all,
// so the two changes ship together or not at all.
export enum LedgerEcosystem {
  Npm = 'npm',
  Pypi = 'pypi',
  RubyGems = 'rubygems',
  Go = 'go',
  Crates = 'crates',
  Maven = 'maven',
  Packagist = 'packagist',
  Hex = 'hex',
  NuGet = 'nuget',
  Pub = 'pub',
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

  // The same prose-ambiguity ruling as codeOnlyAliases, for the canonical name
  // itself: `Go`, `Bun`, `Cursor` and `Wine` are ordinary English words before
  // they are anything else. The name still answers every lookup — it is the
  // entity's identity — but a consumer matching plan prose must skip it, which
  // an alias marker cannot express because a canonical name is not an alias.
  @Column({ type: 'boolean', default: false })
  codeOnlyCanonical: boolean;

  // The package registries this artifact is installed from. EMPTY MEANS
  // UNKNOWN AND MATCHES EVERYTHING — the column can only ever remove a match as
  // it fills, which is what makes it safe to ship over a half-populated ledger.
  // A consumer resolving a code token compares the token's language against
  // this set and skips the entity only when both sides are known and disjoint;
  // that is how `import json` in a `.py` file stops matching the Ruby `json`
  // gem. Derived mechanically from the coordinate's shape and the registry host
  // its evidence cites (`src/common/ledgerEcosystem.ts`), never from prose
  // saying which language something is "for".
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  ecosystem: LedgerEcosystem[];

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
