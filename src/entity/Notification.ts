import { Column, Entity, PrimaryColumn } from 'typeorm';
import { Field, ObjectType } from 'type-graphql';

@Entity()
@ObjectType({ description: 'News and updates notification' })
export class Notification {
  @PrimaryColumn('timestamptz', {
    nullable: false,
    default: () => 'CURRENT_TIMESTAMP',
  })
  @Field({ description: 'The time of the notification' })
  timestamp: Date;

  @Column({ type: 'text' })
  @Field({ description: 'The content of the notification in HTML format' })
  html: string;

  constructor(timestamp: Date, html: string) {
    this.timestamp = timestamp;
    this.html = html;
  }
}
