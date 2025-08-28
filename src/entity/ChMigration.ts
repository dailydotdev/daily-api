import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity()
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
