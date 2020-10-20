import { SchemaDirectiveVisitor, ValidationError } from 'apollo-server-fastify';
import {
  isNonNullType,
  isScalarType,
  GraphQLNonNull,
  GraphQLScalarType,
  isWrappingType,
  isNamedType,
  GraphQLInputField,
} from 'graphql';
import validate from 'validate.js';

export class UrlType extends GraphQLScalarType {
  constructor(type: GraphQLScalarType) {
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
          throw new ValidationError('Field validation failed');
        }
        return parsed;
      },

      parseLiteral(ast) {
        return type.parseLiteral(ast, undefined);
      },
    });
  }
}

export class UrlDirective extends SchemaDirectiveVisitor {
  visitInputFieldDefinition(field: GraphQLInputField): void {
    this.wrapType(field);
  }

  wrapType(field: GraphQLInputField): void {
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
