import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/*
  CompanyType.Company looks awkward today
  but this is supposed to be for Organization entity which will have Company and School as types
  We will eventually deprecate this table and move to Organization entity
*/
export enum CompanyType {
  Company = 'company',
  School = 'school',
}

@Entity()
@Index('IDX_company_name_trgm', { synchronize: false })
@Index('IDX_company_name_lower', { synchronize: false })
@Index('IDX_company_name_slugify', { synchronize: false })
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
    type: 'text',
    default: CompanyType.Company,
  })
  type = CompanyType.Company;
}
