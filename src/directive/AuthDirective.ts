import { SchemaDirectiveVisitor, ForbiddenError } from 'apollo-server-fastify';
import { defaultFieldResolver } from 'graphql';
import { Context } from '../Context';

export class AuthDirective extends SchemaDirectiveVisitor {
  visitObject(type): void {
    this.ensureFieldsWrapped(type);
    type._requiredAuthRole = this.args.requires;
    type._premiumAuthRole = this.args.premium;
  }

  // Visitor methods for nested types like fields and arguments
  // also receive a details object that provides information about
  // the parent and grandparent types.
  visitFieldDefinition(field, details): void {
    this.ensureFieldsWrapped(details.objectType);
    field._requiredAuthRole = this.args.requires;
    field._premiumAuthRole = this.args.premium;
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
      field.resolve = (...args): any => {
        // Get the required Role from the field first, falling back
        // to the objectType if no Role is required by the field:
        const required: string[] | undefined =
          field._requiredAuthRole || objectType._requiredAuthRole;

        const premium: boolean | undefined =
          field._premiumAuthRole || objectType._premiumAuthRole;

        if (!required && !premium) {
          return resolve.apply(this, args);
        }

        const ctx = args[2] as Context;
        if (!ctx.userId) {
          throw new ForbiddenError(
            'Access denied! You need to be authorized to perform this action!',
          );
        }
        if (required.length > 0 || premium) {
          let authorized: boolean;
          if (premium) {
            authorized = ctx.premium;
          } else {
            const roles = ctx.roles;
            authorized =
              roles.findIndex((r) => required.indexOf(r.toUpperCase()) > -1) >
              -1;
          }
          if (!authorized) {
            throw new ForbiddenError(
              'Access denied! You do not have permission for this action!',
            );
          }
        }
        return resolve.apply(this, args);
      };
    });
  }
}
