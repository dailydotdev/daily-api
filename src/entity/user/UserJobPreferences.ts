import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { User } from './User';

export enum WorkLocationType {
  Remote = 'remote',
  Hybrid = 'hybrid',
  OnSite = 'on_site',
}

export interface UserCompensation {
  currency: string;
  amount: number;
}

@Entity()
export class UserJobPreferences {
  @PrimaryColumn()
  userId: string;

  @OneToOne(() => User, (user) => user.jobPreferences)
  @JoinColumn({ name: 'userId' })
  user: Promise<User>;

  @Column({ default: false })
  openToOpportunities: boolean;

  @Column('simple-array')
  preferredRoles: string[]; // Array of job roles

  @Column({
    nullable: true,
  })
  preferredLocationType: WorkLocationType;

  @Column({ default: false })
  openToRelocation: boolean;

  // !! Never send this field to FE, is only stored for better recommendation !!
  // Currency must be "ISO-4217" compliant
  // Amount is yearly based
  @Column({ type: 'jsonb', nullable: true })
  currentTotalComp: UserCompensation;
}
