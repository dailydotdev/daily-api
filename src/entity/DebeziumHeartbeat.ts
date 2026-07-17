import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'heartbeat' })
export class DebeziumHeartbeat {
  @PrimaryColumn({
    type: 'integer',
    primaryKeyConstraintName: 'PK_heartbeat',
  })
  id: number;

  @Column({ type: 'timestamptz' })
  ts: Date;
}
