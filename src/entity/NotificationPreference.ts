import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class NotificationPreference {
  @PrimaryColumn({ type: 'text' })
  userId: string;

  @Column({ type: 'bool', default: false })
  marketingEmail: boolean;

  @Column({ type: 'bool', default: true })
  notificationEmail: boolean;
}
