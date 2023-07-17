// import { ChildEntity, ManyToMany, PrimaryColumn } from 'typeorm';
// import { NotificationPreferenceType } from './NotificationPreference';
// import { Source } from '../Source';
//
// @ChildEntity(NotificationPreferenceType.Source)
// export class NotificationPreferencePost {
//   @PrimaryColumn({ type: 'text' })
//   sourceId: string;
//
//   @ManyToMany(() => Source, { lazy: true, onDelete: 'CASCADE' })
//   source: Promise<Source>;
// }
