import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class Company {
  @PrimaryColumn({ type: 'text' })
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'text', nullable: true })
  image?: string;

  @Column({ type: 'text', array: true, default: [] })
  domains: string[];
}
