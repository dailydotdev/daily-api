import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { Field, ObjectType } from 'type-graphql';

@Entity()
@ObjectType({ description: 'User personal preferences' })
export class Settings {
  @PrimaryColumn({ type: 'text' })
  @Field({ description: 'Id of the user who requested this source' })
  userId: string;

  @Column({ type: 'text', default: 'darcula' })
  @Field({
    description: 'Preferred theme',
  })
  theme: string;

  @Column({ default: true })
  @Field({
    description: 'Whether to enable card animations',
  })
  enableCardAnimations: boolean;

  @Column({ default: true })
  @Field({
    description: 'Whether to show top sites for quick navigation',
  })
  showTopSites: boolean;

  @Column({ default: false })
  @Field({
    description: 'Whether to enable insane mode',
  })
  insaneMode: boolean;

  @Column({ default: true })
  @Field({
    description: 'Whether to enable insane mode for Daily Go',
  })
  appInsaneMode: boolean;

  @Column({ type: 'text', default: 'eco' })
  @Field({
    description: 'Spaciness level for the layout',
  })
  spaciness: string;

  @Column({ default: false })
  @Field({
    description: 'Whether to show unread posts only',
  })
  showOnlyUnreadPosts: boolean;

  @UpdateDateColumn()
  @Field({ description: 'Time of last update' })
  updatedAt: Date;
}
