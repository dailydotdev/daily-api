import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class UserSkill {
  @PrimaryColumn({
    type: 'text',
    update: false,
    insert: false,
    nullable: false,
    unique: true,
    generatedType: 'STORED',
    asExpression: `trim(BOTH '-' FROM regexp_replace(lower(trim(COALESCE(LEFT(name,100),''))), '[^a-z0-9-]+', '-', 'gi'))`,
  })
  slug: string;

  @Column({ type: 'text', unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;
}
