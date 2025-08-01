import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import type { User } from './User';

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

  @OneToOne('User', (user: User) => user.jobPreferences)
  @JoinColumn({ name: 'userId' })
  user: Promise<User>;

  @Column({ default: false })
  openToOpportunities: boolean;

  @Column({ type: 'text', array: true, default: [] })
  preferredRoles: string[];

  @Column({
    type: 'text',
    nullable: true,
  })
  preferredLocationType: WorkLocationType;

  @Column({ default: false })
  openToRelocation: boolean;

  // Currency must be "ISO-4217" compliant
  // Amount is yearly based
  @Column({ type: 'jsonb', default: {} })
  currentTotalComp: Partial<UserCompensation>;
}
