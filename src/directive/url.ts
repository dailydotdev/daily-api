import { ValidationError } from 'apollo-server-errors';
import {
  isNonNullType,
  isScalarType,
  GraphQLScalarType,
  GraphQLFieldConfig,
  GraphQLInputFieldConfig,
  GraphQLSchema,
} from 'graphql';
import validate from 'validate.js';
import { getDirective, MapperKind, mapSchema } from '@graphql-tools/utils';

const directiveName = 'url';

export const typeDefs = /* GraphQL */ `
  directive @${directiveName} on INPUT_FIELD_DEFINITION
`;

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

const urlTypes: Record<string, GraphQLScalarType> = {};

function getUrlType(type: GraphQLScalarType): GraphQLScalarType {
  const urlType = urlTypes[type.name];
  if (!urlType) {
    const newType = new UrlType(type);
    urlTypes[type.name] = newType;
    return newType;
  }

  return urlType;
}

function wrapType<
  F extends GraphQLFieldConfig<unknown, unknown> | GraphQLInputFieldConfig,
>(fieldConfig: F): void {
  if (
    isNonNullType(fieldConfig.type) &&
    isScalarType(fieldConfig.type.ofType)
  ) {
    fieldConfig.type = getUrlType(fieldConfig.type.ofType);
  } else if (isScalarType(fieldConfig.type)) {
    fieldConfig.type = getUrlType(fieldConfig.type);
  } else {
    throw new Error(`Not a scalar type: ${fieldConfig.type.toString()}`);
  }
}

export const transformer = (schema: GraphQLSchema): GraphQLSchema =>
  mapSchema(schema, {
    [MapperKind.FIELD]: (fieldConfig) => {
      const urlDirective = getDirective(
        schema,
        fieldConfig,
        directiveName,
      )?.[0];
      if (urlDirective) {
        wrapType(fieldConfig);
        return fieldConfig;
      }
    },
  });
