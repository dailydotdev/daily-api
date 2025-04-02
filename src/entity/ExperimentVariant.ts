import { Column, Entity, PrimaryColumn } from 'typeorm';
import { ConnectionManager } from './posts';

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

export const getExperimentVariant = (
  con: ConnectionManager,
  feature: string,
  variant: string,
) =>
  con.getRepository(ExperimentVariant).findOne({ where: { feature, variant } });
