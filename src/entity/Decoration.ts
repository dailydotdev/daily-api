import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class Decoration {
  @PrimaryColumn({ type: 'text' })
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text' })
  media: string;

  @Column({ type: 'text', default: 'subscriber' })
  decorationGroup: string;

  @Column({ type: 'text', nullable: true })
  unlockCriteria: string | null;

  @Column({ type: 'integer', default: 0 })
  groupOrder: number;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'integer', nullable: true })
  price: number | null;

  @Column({ type: 'timestamp', default: () => 'now()' })
  createdAt: Date;
}
