import { SchemaDirectiveVisitor } from 'apollo-server-fastify';
import {
  isNonNullType,
  isScalarType,
  GraphQLNonNull,
  GraphQLScalarType,
  isWrappingType,
  isNamedType,
} from 'graphql';
import * as validate from 'validate.js';
import { ValidationError } from '../errors';

export class UrlType extends GraphQLScalarType {
  constructor(type) {
    super({
      name: 'URL',
      description: 'Enforces a URL valid format',
      serialize(value) {
        return type.serialize(value);
      },

      parseValue(value) {
        const parsed = type.parseValue(value);
        const msg = validate.single(parsed, { url: true });
        if (msg) {
          throw new ValidationError(msg);
        }
        return parsed;
      },

      parseLiteral(ast) {
        return type.parseLiteral(ast);
      },
    });
  }
}

export class UrlDirective extends SchemaDirectiveVisitor {
  visitInputFieldDefinition(field): void {
    this.wrapType(field);
  }

  wrapType(field): void {
    if (isNonNullType(field.type) && isScalarType(field.type.ofType)) {
      field.type = new GraphQLNonNull(new UrlType(field.type.ofType));
    } else if (isScalarType(field.type)) {
      field.type = new UrlType(field.type);
    } else {
      throw new Error(`Not a scalar type: ${field.type}`);
    }

    // Workaround to make schema introspection work
    const typeMap = this.schema.getTypeMap();
    let type = field.type;
    if (isWrappingType(type)) {
      type = type.ofType;
    }
    if (isNamedType(type) && !typeMap[type.name]) {
      typeMap[type.name] = type;
    }
  }
}
