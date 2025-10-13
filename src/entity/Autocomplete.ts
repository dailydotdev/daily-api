import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';
import type { ConnectionManager } from './posts';

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

export const insertOrIgnoreAutocomplete = async (
  con: ConnectionManager,
  type: AutocompleteType,
  values: string[],
): Promise<void> => {
  if (!values.length) {
    return;
  }

  // slug will throw an error for any duplicates which will be ignored
  await con
    .getRepository(Autocomplete)
    .createQueryBuilder()
    .insert()
    .orIgnore()
    .values(
      values.map((value) => ({
        type,
        value,
      })),
    )
    .execute();
};
