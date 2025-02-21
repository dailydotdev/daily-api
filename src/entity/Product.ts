import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ProductFlags = Partial<{
  description: string;
}>;

export type ProductFlagsPublic = Pick<ProductFlags, 'description'>;

export enum ProductType {
  Award = 'award',
}

@Entity()
export class Product {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column()
  type: ProductType;

  @Column()
  image: string;

  @Column()
  name: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column()
  value: number;

  @Column({ type: 'jsonb', default: {} })
  flags: ProductFlags;
}
