import { SchemaDirectiveVisitor } from 'apollo-server-fastify';
import { defaultFieldResolver } from 'graphql';
import { Context } from '../Context';
import { ForbiddenError, UnauthorizedError } from '../errors';

export class AuthDirective extends SchemaDirectiveVisitor {
  visitObject(type): void {
    this.ensureFieldsWrapped(type);
    type._requiredAuthRole = this.args.requires;
  }

  // Visitor methods for nested types like fields and arguments
  // also receive a details object that provides information about
  // the parent and grandparent types.
  visitFieldDefinition(field, details): void {
    this.ensureFieldsWrapped(details.objectType);
    field._requiredAuthRole = this.args.requires;
  }

  ensureFieldsWrapped(objectType): void {
    // Mark the GraphQLObjectType object to avoid re-wrapping:
    if (objectType._authFieldsWrapped) return;
    objectType._authFieldsWrapped = true;

    const fields = objectType.getFields();

    Object.keys(fields).forEach((fieldName) => {
      const field = fields[fieldName];
      const { resolve = defaultFieldResolver } = field;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      field.resolve = async (...args): Promise<any> => {
        // Get the required Role from the field first, falling back
        // to the objectType if no Role is required by the field:
        const required: string[] | undefined =
          field._requiredAuthRole || objectType._requiredAuthRole;

        if (!required) {
          return resolve.apply(this, args);
        }

        const ctx = args[2] as Context;
        if (!ctx.userId) {
          throw new UnauthorizedError();
        }
        if (required.length > 0) {
          const roles = await ctx.getRoles();
          const authorized =
            roles.findIndex((r) => required.indexOf(r.toUpperCase()) > -1) > -1;
          if (!authorized) {
            throw new ForbiddenError();
          }
        }
        return resolve.apply(this, args);
      };
    });
  }
}
