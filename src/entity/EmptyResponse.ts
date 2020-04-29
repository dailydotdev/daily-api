import { Field, ObjectType } from 'type-graphql';

@ObjectType({ description: 'Used for mutations with empty response' })
export class EmptyResponse {
  @Field({
    description: 'Every type must have at least one field',
    defaultValue: true,
  })
  _: boolean;
}
