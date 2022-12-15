import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class DeviceNotificationPreference {
  @PrimaryColumn({ type: 'text' })
  userId: string;

  @PrimaryColumn({ type: 'text' })
  deviceId: string;

  @Column({ type: 'text', default: null })
  integrationId?: string;

  @Column({ type: 'text' })
  description: Date | null;

  @Column({ type: 'bool', default: false })
  pushNotification: boolean;
}
