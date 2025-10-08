import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

export enum AutocompleteType {
  FieldOfStudy = 'field_of_study',
  Degree = 'degree',
  Role = 'role',
}

const compositePrimaryKeyName = 'PK_autocomplete_value_type';

@Entity()
@Index('IDX_autocomplete_value_enabled_trgm', { synchronize: false })
export class Autocomplete {
  @PrimaryColumn({
    type: 'text',
    primaryKeyConstraintName: compositePrimaryKeyName,
  })
  value: string;

  @PrimaryColumn({
    type: 'text',
    primaryKeyConstraintName: compositePrimaryKeyName,
  })
  type: AutocompleteType;

  @Column({ type: 'timestamp', default: () => 'now()' })
  createdAt: Date;

  @Column({ default: true })
  enabled: boolean;
}
