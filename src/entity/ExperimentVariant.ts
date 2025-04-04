import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class ExperimentVariant {
  @PrimaryColumn({ type: 'text' })
  feature: string;

  @PrimaryColumn({ type: 'text' })
  variant: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'text', default: null })
  value: string;
}
