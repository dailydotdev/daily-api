import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

enum CompanyType {
  Business = 'business',
  School = 'school',
}

@Entity()
export class Company {
  @PrimaryColumn({ type: 'text' })
  id: string;

  @Column({ type: 'text' })
  name: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'text' })
  image: string;

  @Column({ type: 'text', array: true, default: [] })
  domains: string[];

  @Column({
    type: 'enum',
    enum: CompanyType,
    default: CompanyType.Business,
  })
  type: CompanyType = CompanyType.Business;
}
