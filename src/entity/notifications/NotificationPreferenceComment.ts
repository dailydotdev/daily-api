// import { ChildEntity, ManyToMany, PrimaryColumn } from 'typeorm';
// import { NotificationPreferenceType } from './NotificationPreference';
//
// @ChildEntity(NotificationPreferenceType.Comment)
// export class NotificationPreferencePost {
//   @PrimaryColumn({ type: 'text' })
//   commentId: string;
//
//   @ManyToMany(() => Comment, { lazy: true, onDelete: 'CASCADE' })
//   comment: Promise<Comment>;
// }
