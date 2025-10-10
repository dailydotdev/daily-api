import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity()
export class UserSkill {
  @PrimaryColumn({
    type: 'text',
    update: false,
    insert: false,
    nullable: false,
    generatedType: 'STORED',
    asExpression: `trim(BOTH '-' FROM regexp_replace(lower(trim(COALESCE(LEFT(name,100),''))), '[^a-z0-9-]+', '-', 'gi'))`,
    primaryKeyConstraintName: 'PK_user_skill_slug',
  })
  slug: string;

  @Column({ type: 'text' })
  @Index('IDX_user_skill_name', { unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: false })
  valid: boolean;
}
