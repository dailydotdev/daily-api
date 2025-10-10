import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

export enum AutocompleteType {
  FieldOfStudy = 'field_of_study',
  Degree = 'degree',
  Role = 'role',
  Skill = 'skill',
}

const compositePrimaryKeyName = 'PK_autocomplete_type_slug';

@Entity()
@Index('IDX_autocomplete_slug_enabled_trgm', { synchronize: false })
export class Autocomplete {
  @PrimaryColumn({
    type: 'text',
    primaryKeyConstraintName: compositePrimaryKeyName,
  })
  type: AutocompleteType;

  @PrimaryColumn({
    type: 'text',
    update: false,
    insert: false,
    nullable: false,
    generatedType: 'STORED',
    asExpression: `trim(BOTH '-' FROM regexp_replace(lower(trim(COALESCE(LEFT(name,100),''))), '[^a-z0-9-]+', '-', 'gi'))`,
    primaryKeyConstraintName: compositePrimaryKeyName,
  })
  slug: string;

  @Column({ type: 'text' })
  value: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ default: false })
  enabled: boolean;
}
