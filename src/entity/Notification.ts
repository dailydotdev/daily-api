import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class Notification {
  @PrimaryColumn('timestamptz', {
    nullable: false,
    default: () => 'CURRENT_TIMESTAMP',
  })
  timestamp: Date;

  @Column({ type: 'text' })
  html: string;

  constructor(timestamp: Date, html: string) {
    this.timestamp = timestamp;
    this.html = html;
  }
}
