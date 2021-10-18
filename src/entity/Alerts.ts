import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity()
export class Alerts {
  @PrimaryColumn({ type: 'text' })
  @Index()
  userId: string;

  @Column({ type: 'bool', default: true })
  filter: boolean;
}

export const ALERTS_DEFAULT: Omit<Alerts, 'userId'> = { filter: true };
