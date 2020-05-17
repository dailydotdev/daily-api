import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class Checkpoint {
  @PrimaryColumn({ type: 'text' })
  key: string;

  @Column()
  timestamp: Date;
}
