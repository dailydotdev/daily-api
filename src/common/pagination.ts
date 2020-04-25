import { GraphQLResolveInfo, SelectionNode, FieldNode } from 'graphql';
import { FieldNodeInfo } from '@mando75/typeorm-graphql-loader/dist/types';

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
