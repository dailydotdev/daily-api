import { GraphQLResolveInfo, SelectionNode, FieldNode } from 'graphql';
import { FieldNodeInfo } from '@mando75/typeorm-graphql-loader/dist/types';
import { unbase64 } from './base64';

/**
 * Finds a single node in the GraphQL AST to return the feed info for
 * @param info
 * @param fieldName
 */
export const getFieldNodeInfo = (
  info: GraphQLResolveInfo | FieldNodeInfo,
  fieldName: string,
): FieldNodeInfo => {
  const childFieldNode = (info.fieldNodes as ReadonlyArray<FieldNode>)
    .map((node) => (node.selectionSet ? node.selectionSet.selections : []))
    .flat()
    .find((selection: SelectionNode) =>
      selection.kind !== 'InlineFragment'
        ? selection.name.value === fieldName
        : false,
    ) as FieldNode;

  const fieldNodes = [childFieldNode];
  return { fieldNodes, fragments: info.fragments, fieldName };
};

export const getRelayNodeInfo = (info: GraphQLResolveInfo): FieldNodeInfo =>
  getFieldNodeInfo(getFieldNodeInfo(info, 'edges'), 'node');

export const getCursorFromAfter = (after?: string): string | null => {
  if (!after) {
    return null;
  }
  return unbase64(after).split(':')[1];
};

export const getArgsFromAfter = <
  T extends Record<string, string> = Record<string, string>,
>(
  after: string,
): Partial<T> => {
  if (!after) {
    return {};
  }

  const unbased = unbase64(after);

  if (!unbased) {
    return {};
  }

  return unbased.split(';').reduce((result, param) => {
    const [key, value] = param.split(':');

    return { ...result, [key]: value };
  }, {});
};

export const getLimit = ({
  limit,
  defaultLimit = 10,
  max = 100,
}: {
  limit: number;
  defaultLimit?: number;
  max?: number;
}) => {
  return Math.max(Math.min(limit ?? defaultLimit, max), 1);
};
