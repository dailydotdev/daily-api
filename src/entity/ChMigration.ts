import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'migrations_ch' })
export class ChMigration {
  @PrimaryColumn({ type: 'bigint' })
  id: string;

  @Column()
  name: string;

  @UpdateDateColumn()
  timestamp: Date;

  @Column()
  dirty: boolean;
}
