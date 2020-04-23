import { MiddlewareFn } from 'type-graphql';
import { Context } from '../Context';

export const ResolverTracing: MiddlewareFn<Context> = async (
  { context, info },
  next,
) => {
  const name = `${info.parentType.name}.${info.fieldName}`;
  const childSpan = context.span.createChildSpan({ name });
  childSpan.addLabel('/graphql/parent', info.parentType.name);
  childSpan.addLabel('/graphql/field', info.fieldName);
  childSpan.addLabel('/graphql/operation/name', info.operation.name);
  childSpan.addLabel('/graphql/operation/type', info.operation.operation);
  try {
    await next();
    childSpan.endSpan();
  } catch (err) {
    childSpan.endSpan();
    throw err;
  }
};
