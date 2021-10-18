import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity()
export class Alerts {
  @PrimaryColumn({ type: 'text' })
  @Index()
  userId: string;

  @Column({ type: 'bool', default: true })
  filter: boolean;
}
