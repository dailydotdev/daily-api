import { Column, Entity, PrimaryColumn } from 'typeorm';

export enum ExperimentVariantType {
  ProductPricing = 'productPricing',
}

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

  @Column({ type: 'text' })
  type: ExperimentVariantType;
}
