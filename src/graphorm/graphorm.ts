/* eslint-disable @typescript-eslint/no-explicit-any */

import { GraphQLResolveInfo } from 'graphql';
import {
  SelectQueryBuilder,
  EntityMetadata,
  EntityNotFoundError,
} from 'typeorm';
import { parseResolveInfo, ResolveTree } from 'graphql-parse-resolve-info';
import { Context } from '../Context';
import { Connection, Edge } from 'graphql-relay';
import { EntityTarget } from 'typeorm/common/EntityTarget';
import type { GraphqlPayload } from '../compatibility/utils';

export type QueryBuilder = SelectQueryBuilder<any>;

export type GraphORMBuilder = { queryBuilder: QueryBuilder; alias: string };

export interface GraphORMPagination {
  limit: number;
  hasPreviousPage: (nodeSize: number) => boolean;
  hasNextPage: (nodeSize: number) => boolean;
  nodeToCursor: (node: any, index: number) => string;
}

export interface GraphORMRelation {
  isMany: boolean;
  parentColumn?: string;
  childColumn?: string;
  customRelation?: (
    ctx: Context,
    parentAlias: string,
    childAlias: string,
    qb: QueryBuilder,
  ) => QueryBuilder;
  sort?: string;
  order?: 'ASC' | 'DESC';
}

export interface GraphORMField {
  // Define the column to select or provide a custom function
  select?:
    | string
    | ((
        ctx: Context,
        alias: string,
        qb: QueryBuilder,
      ) => QueryBuilder | string);
  rawSelect?: boolean;
  // Add custom settings to the query (should be used for complex types only!)
  customQuery?: (ctx: Context, alias: string, qb: QueryBuilder) => QueryBuilder;
  // Need to provide relation information if it doesn't exist
  relation?: GraphORMRelation;
  // Apply this function on the value after querying the database
  transform?: (value: any, ctx: Context, parent: unknown) => any;
  // Specify if this field is an alias to another field
  alias?: { field: string; type: string };
  // Settings for pagination
  pagination?: GraphORMPagination;
  // Whether this field is of JSON type
  jsonType?: boolean;
}

export type RequiredColumnConfig = {
  column: string;
  columnAs: string;
  isJson?: boolean;
};

export interface GraphORMType {
  // Define manually the table to select from
  from?: string;
  // Define manually the table to take metadata from
  metadataFrom?: string;
  // Define fields customizations
  fields?: { [name: string]: GraphORMField };
  // Array of columns to select regardless of the resolve tree
  requiredColumns?: (string | RequiredColumnConfig)[];
  // Only allowed columns when the user is not authenticated
  anonymousAllowedColumns?: (string | RequiredColumnConfig)[];
  // Define a function to manipulate the query every time
  additionalQuery?: (
    ctx: Context,
    alias: string,
    qb: QueryBuilder,
  ) => QueryBuilder;
}

// Define custom mapping to types
export interface GraphORMMapping {
  [name: string]: GraphORMType;
}

const checkConflictingRequiredColumns = (
  required: (string | RequiredColumnConfig)[],
  anonColumns: (string | RequiredColumnConfig)[],
): void => {
  const requiredColumnNames = required.map((col) =>
    typeof col === 'string' ? col : col.column,
  );
  const anonColumnNames = anonColumns.map((col) =>
    typeof col === 'string' ? col : col.column,
  );

  const conflicts = requiredColumnNames.filter(
    (col) => !anonColumnNames.includes(col),
  );
  if (conflicts.length > 0) {
    const conflictedColumns = conflicts.join(', ');
    throw new Error(
      `You can't have required columns outside of anonymous allowed columns: ${conflictedColumns}`,
    );
  }
};

export class GraphORM {
  mappings: GraphORMMapping | null;

  constructor(mappings?: GraphORMMapping) {
    this.mappings = mappings || null;

    if (this.mappings) {
      Object.values(this.mappings).forEach((type) => {
        if (type.anonymousAllowedColumns && type.requiredColumns) {
          checkConflictingRequiredColumns(
            type.requiredColumns,
            type.anonymousAllowedColumns,
          );
        }
      });
    }
  }

  /**
   * Returns the entity metadata
   * @param ctx GraphQL context of the request
   * @param type Name of the GraphQL parent type
   */
  getMetadata(ctx: Context, type: string): EntityMetadata {
    const mapping = this.mappings?.[type];
    return ctx.con.getMetadata(mapping?.metadataFrom ?? mapping?.from ?? type);
  }

  /**
   * Finds the relation between parent and child entities
   * @param parentMetadata Parent entity metadata
   * @param childMetadata Child entity metadata
   */
  findRelation(
    parentMetadata: EntityMetadata,
    childMetadata: EntityMetadata,
    field: string,
  ): GraphORMRelation | null {
    const relation = childMetadata.relations.find(
      (rel) => rel.inverseEntityMetadata.name === parentMetadata.name,
    );
    if (relation?.foreignKeys?.[0]) {
      const fk = relation.foreignKeys[0];
      return {
        isMany: relation.relationType === 'many-to-one',
        parentColumn: fk.referencedColumnNames[0],
        childColumn: fk.columnNames[0],
      };
    }
    const inverseRelations = parentMetadata.relations.filter(
      (rel) => rel.inverseEntityMetadata.name === childMetadata.name,
    );
    const inverseRelation =
      inverseRelations.length === 1
        ? inverseRelations[0]
        : inverseRelations.find((rel) => {
            const fk = rel.foreignKeys[0].columnNames[0];
            // the issue came from when we reference a table twice in the same entity (ex. Author and Source) - always using the first element of the array won't work
            // strip the id part to compare the reference as it is a common convention on ORMs (ex. on EF Core ORM)
            // ex. when we're looking for the "author" - it is highliy likely the relevant FK is named "authorId" - so we remove the "Id" part for comparison
            // else we will have to force utilizing the metadata that would come from the "JoinColumn" provided by typeorm but have to explicitly define it
            return fk.substring(0, fk.length - 2) === field;
          });

    if (inverseRelation) {
      const fk = inverseRelation.foreignKeys[0];
      return {
        isMany: inverseRelation.relationType === 'one-to-many',
        parentColumn: fk.columnNames[0],
        childColumn: fk.referencedColumnNames[0],
      };
    }
    return null;
  }

  /**
   * Add a selection of a complex field to the query builder
   * @param ctx GraphQL context of the request
   * @param builder Select query builder to augment with new field
   * @param alias Alias of the parent table
   * @param metadata Parent entity metadata (from TypeORM)
   * @param type Name of the GraphQL parent type
   * @param field Resolve tree of the field
   * @param childType Type of the child field to query
   */
  selectComplexField(
    ctx: Context,
    builder: QueryBuilder,
    alias: string,
    metadata: EntityMetadata,
    type: string,
    field: ResolveTree,
    childType: string,
  ): QueryBuilder {
    const mapping = this.mappings?.[type]?.fields?.[field.name];
    const pagination = mapping?.pagination;
    const paginatedField = pagination ? this.getPaginatedField(field) : field;
    const paginatedType = pagination
      ? Object.keys(paginatedField.fieldsByTypeName)[0]
      : childType;
    const relation =
      mapping?.relation ||
      this.findRelation(
        metadata,
        this.getMetadata(ctx, paginatedType),
        field.name,
      );
    if (!relation) {
      throw new Error(`Could not find relation ${type}.${field.name}`);
    }
    const select = relation.isMany
      ? `coalesce(jsonb_agg(res), '[]'::jsonb)`
      : `to_jsonb(res)`;
    // Aggregate results as jsonb
    return builder.select(select, 'children').from((subBuilder) => {
      // Select all sub fields
      const childBuilder = this.selectType(
        ctx,
        subBuilder,
        paginatedType,
        paginatedField.fieldsByTypeName[paginatedType],
      );
      if (relation.customRelation) {
        childBuilder.queryBuilder = relation.customRelation(
          ctx,
          alias,
          childBuilder.alias,
          childBuilder.queryBuilder,
        );
      } else {
        // Add where clause to fetch children by relation
        childBuilder.queryBuilder = childBuilder.queryBuilder.where(
          `"${childBuilder.alias}"."${relation.childColumn}" = "${alias}"."${relation.parentColumn}"`,
        );
      }
      if (relation.isMany && relation.sort) {
        childBuilder.queryBuilder = childBuilder.queryBuilder.orderBy(
          `"${childBuilder.alias}"."${relation.sort}"`,
          relation.order ?? 'ASC',
        );
      } else if (!relation.isMany) {
        childBuilder.queryBuilder = childBuilder.queryBuilder.limit(1);
      }

      if (pagination) {
        childBuilder.queryBuilder = childBuilder.queryBuilder.limit(
          pagination.limit,
        );
      }

      // Apply custom query if any
      const customQuery =
        this.mappings?.[type]?.fields?.[field.name]?.customQuery;
      if (customQuery) {
        return customQuery(ctx, childBuilder.alias, childBuilder.queryBuilder);
      }
      return childBuilder.queryBuilder;
    }, 'res');
  }

  /**
   * Add a selection of a given field to the query builder
   * @param ctx GraphQL context of the request
   * @param builder Select query builder to augment with new field
   * @param alias Alias of the parent table
   * @param metadata Parent entity metadata (from TypeORM)
   * @param type Name of the GraphQL parent type
   * @param field Resolve tree of the field
   */
  selectField(
    ctx: Context,
    builder: QueryBuilder,
    alias: string,
    metadata: EntityMetadata,
    type: string,
    field: ResolveTree,
  ): QueryBuilder {
    const childType = Object.keys(field.fieldsByTypeName)[0];
    const mapping = this.mappings?.[type]?.fields?.[field.name];
    if (mapping?.alias) {
      const fieldsByTypeName = childType
        ? {
            [mapping.alias.type]: field.fieldsByTypeName[childType],
          }
        : field.fieldsByTypeName;
      return this.selectField(ctx, builder, alias, metadata, type, {
        ...field,
        name: mapping.alias.field,
        alias: field.name,
        fieldsByTypeName,
      });
    }

    if (childType && !mapping?.jsonType) {
      // If current field is a of custom type
      return builder.addSelect(
        (subBuilder) =>
          this.selectComplexField(
            ctx,
            subBuilder,
            alias,
            metadata,
            type,
            field,
            childType,
          ),
        field.alias,
      );
    }
    // Else, scalar value
    if (mapping) {
      const { select, rawSelect } = mapping;
      if (select) {
        if (typeof select === 'string') {
          if (rawSelect) {
            return builder.addSelect(select, field.alias);
          } else {
            return builder.addSelect(`"${alias}"."${select}"`, field.alias);
          }
        }
        const res = select(ctx, alias, builder.subQuery());
        const subQuery = typeof res === 'string' ? res : res.getQuery();
        return builder.addSelect(subQuery, field.alias);
      }
    }
    if (metadata.findColumnWithPropertyName(field.name)) {
      return builder.addSelect(`"${alias}"."${field.name}"`, field.alias);
    }
    return builder;
  }

  /**
   * Adds a selection of a given type to the query builder
   * @param ctx GraphQL context of the request
   * @param builder Select query builder to augment with new field
   * @param type Name of the GraphQL type
   * @param fieldsByTypeName Requested fields for the given type
   */
  selectType(
    ctx: Context,
    builder: QueryBuilder,
    type: string,
    fieldsByTypeName: { [p: string]: ResolveTree },
  ): GraphORMBuilder {
    const fields = Object.values(fieldsByTypeName);
    const originalType = this.mappings?.[type]?.from ?? type;
    const originalMetadata = ctx.con.getMetadata(originalType);
    const tableName = originalMetadata.tableName;
    const entityMetadata = this.getMetadata(ctx, type);
    // Used to make sure no conflicts in aliasing
    const randomStr = Math.random().toString(36).substring(2, 5);
    const alias = `${tableName.toLowerCase()}_${randomStr}`;
    let newBuilder = builder.from(tableName, alias).select([]);
    const anonColumns = this.mappings?.[type]?.anonymousAllowedColumns || [];
    const isRestrictedColumn = (col: string) =>
      !ctx.userId && anonColumns.length && !anonColumns.includes(col);

    fields.forEach((field) => {
      if (isRestrictedColumn(field.name)) {
        return;
      }

      newBuilder = this.selectField(
        ctx,
        newBuilder,
        alias,
        entityMetadata,
        type,
        field,
      );
    });
    if (this.mappings?.[type]?.additionalQuery) {
      newBuilder = this.mappings[type].additionalQuery(ctx, alias, newBuilder);
    }
    (this.mappings?.[type]?.requiredColumns ?? []).forEach((col) => {
      if (isRestrictedColumn(typeof col === 'string' ? col : col.column)) {
        return;
      }

      const columnOptions =
        typeof col === 'object'
          ? col
          : {
              column: col,
              columnAs: col,
              isJson: false,
            };

      if (columnOptions.isJson) {
        newBuilder = newBuilder.addSelect(
          `${alias}.${columnOptions.column}`,
          columnOptions.columnAs,
        );
      } else {
        newBuilder = newBuilder.addSelect(
          `${alias}."${columnOptions.column}"`,
          columnOptions.columnAs,
        );
      }
    });
    return { queryBuilder: newBuilder, alias };
  }

  /**
   * Transforms a given field after the query
   * @param ctx GraphQL context of the request
   * @param parentType Name of the GraphQL parent type
   * @param field Resolve tree of the field
   * @param value A single query result
   * @param parent Field's parent value
   * @param entityMetadata TypeORM's entity metadata
   */
  transformField(
    ctx: Context,
    parentType: string,
    field: ResolveTree,
    value: unknown,
    parent: Record<string, unknown>,
    entityMetadata?: EntityMetadata,
  ): any {
    const mapping = this.mappings?.[parentType]?.fields?.[field.name];
    if (mapping?.transform) {
      return mapping.transform(value, ctx, parent);
    }
    if (value === null || value === undefined) {
      return value;
    }
    const childType = Object.keys(field.fieldsByTypeName)[0];
    if (childType) {
      // If current field is a of custom type
      if (Array.isArray(value)) {
        // If value is an array

        const pagination = mapping?.pagination;
        const paginatedField = pagination
          ? this.getPaginatedField(field)
          : field;
        const paginatedType = pagination
          ? Object.keys(paginatedField.fieldsByTypeName)[0]
          : childType;

        const nodes = value.map((element) =>
          this.transformType(
            ctx,
            element,
            paginatedType,
            paginatedField.fieldsByTypeName[paginatedType],
          ),
        );
        if (pagination) {
          return this.nodesToConnection(
            nodes,
            nodes.length,
            pagination.hasPreviousPage,
            pagination.hasNextPage,
            pagination.nodeToCursor,
          );
        }
        return nodes;
      }
      return this.transformType(
        ctx,
        value as Record<string, unknown>,
        childType,
        field.fieldsByTypeName[childType],
      );
    }
    if (entityMetadata?.findColumnWithDatabaseName(field.name)?.type === Date) {
      return new Date(value as string);
    }
    return value;
  }

  getMetadataOrNull(ctx: Context, type: string): EntityMetadata | undefined {
    try {
      return this.getMetadata(ctx, type);
    } catch (originalError) {
      const err = originalError as Error;

      if (err?.name === 'EntityMetadataNotFoundError') {
        return;
      }
      throw err;
    }
  }

  /**
   * Transforms a given type after the query
   * @param ctx GraphQL context of the request
   * @param value A single query result
   * @param type Name of the GraphQL type
   * @param fieldsByTypeName Requested fields for the given type
   */
  transformType<T>(
    ctx: Context,
    value: Record<string, unknown>,
    type: string,
    fieldsByTypeName: ResolveTree | { [p: string]: ResolveTree },
  ): T {
    const entityMetadata = this.getMetadataOrNull(ctx, type);
    const fields = Object.values(fieldsByTypeName);
    return fields.reduce(
      (acc, field) => ({
        ...acc,
        [field.alias]: this.transformField(
          ctx,
          type,
          field,
          value[field.alias],
          value,
          entityMetadata,
        ),
      }),
      value,
    );
  }

  /**
   * Get the resolve tree of a field by its hierarchy
   * @param info GraphQL resolve info
   * @param hierarchy Array of field names
   */
  getFieldByHierarchy(info: ResolveTree, hierarchy: string[]): ResolveTree {
    const root = info.fieldsByTypeName?.[Object.keys(info.fieldsByTypeName)[0]];
    const child = Object.values(root).find(
      (field) => field.name === hierarchy[0],
    );
    if (hierarchy.length === 1) {
      return child!;
    }
    return this.getFieldByHierarchy(child!, hierarchy.slice(1));
  }

  /**
   * Returns the type of the requested paginated object (Relay style)
   * @param info GraphQL resolve tree
   */
  getPaginatedField(info: ResolveTree): ResolveTree {
    return this.getFieldByHierarchy(info, ['edges', 'node']);
  }

  nodesToConnection<T>(
    nodes: T[],
    pretransformNodeSize: number,
    hasPreviousPage: (nodeSize: number) => boolean,
    hasNextPage: (nodeSize: number) => boolean,
    nodeToCursor: (node: T, index: number) => string,
  ): Connection<T> {
    if (!nodes.length) {
      return {
        pageInfo: {
          startCursor: null,
          endCursor: null,
          hasNextPage: hasNextPage(pretransformNodeSize),
          hasPreviousPage: hasPreviousPage(pretransformNodeSize),
        },
        edges: [],
      };
    }
    const edges = nodes.map(
      (n, i): Edge<T> => ({
        node: n,
        cursor: nodeToCursor(n, i),
      }),
    );
    return {
      pageInfo: {
        startCursor: edges[0].cursor,
        endCursor: edges[edges.length - 1].cursor,
        hasNextPage: hasNextPage(pretransformNodeSize),
        hasPreviousPage: hasPreviousPage(pretransformNodeSize),
      },
      edges,
    };
  }

  async queryResolveTree<T>(
    ctx: Context,
    resolveTree: ResolveTree,
    beforeQuery?: (builder: GraphORMBuilder) => GraphORMBuilder,
    readReplica?: boolean,
  ): Promise<T[]> {
    const rootType = Object.keys(resolveTree.fieldsByTypeName)[0];
    const fieldsByTypeName = resolveTree.fieldsByTypeName[rootType];

    let slaveRunner = null;
    if (readReplica) {
      slaveRunner = ctx.con.createQueryRunner('slave');
    }

    let builder = this.selectType(
      ctx,
      ctx.con.createQueryBuilder(),
      rootType,
      fieldsByTypeName,
    );
    if (beforeQuery) {
      builder = beforeQuery(builder);
    }
    if (slaveRunner) {
      builder.queryBuilder.setQueryRunner(slaveRunner);
    }

    let res: any[];

    const body = ctx?.req?.body as GraphqlPayload;
    if (!!body?.operationName) {
      builder.queryBuilder.comment(
        `action='${(ctx?.req?.body as GraphqlPayload)?.operationName}'`,
      );
    }

    try {
      res = await builder.queryBuilder.getRawMany();
    } catch (error) {
      throw error;
    } finally {
      if (slaveRunner) {
        await slaveRunner.release();
      }
    }

    return res.map((value) =>
      this.transformType(ctx, value, rootType, fieldsByTypeName),
    );
  }

  /**
   * Queries the database to fulfill a GraphQL request
   * @param ctx GraphQL context of the request
   * @param resolveInfo GraphQL resolve info of the request
   * @param beforeQuery A callback function that is called before executing the query
   * @param readReplica Whether to use the read replica instance
   */
  query<T>(
    ctx: Context,
    resolveInfo: GraphQLResolveInfo,
    beforeQuery?: (builder: GraphORMBuilder) => GraphORMBuilder,
    readReplica?: boolean,
  ): Promise<T[]> {
    const parsedInfo = parseResolveInfo(resolveInfo) as ResolveTree;
    if (parsedInfo) {
      return this.queryResolveTree(ctx, parsedInfo, beforeQuery, readReplica);
    }
    throw new Error('Resolve info is empty');
  }

  async queryOneOrFail<T>(
    ctx: Context,
    resolveInfo: GraphQLResolveInfo,
    beforeQuery?: (builder: GraphORMBuilder) => GraphORMBuilder,
    entityName?: EntityTarget<T>,
    readReplica?: boolean,
  ): Promise<T> {
    const res = await this.query<T>(ctx, resolveInfo, beforeQuery, readReplica);

    if (!res.length) {
      throw new EntityNotFoundError(
        entityName ?? resolveInfo.path.typename!,
        'not found',
      );
    }

    return res[0];
  }

  /**
   * Queries the database to fulfill a GraphQL request.
   * Returns the first result or null if none is found
   *
   * @param ctx GraphQL context of the request
   * @param resolveInfo GraphQL resolve info of the request
   * @param beforeQuery A callback function that is called before executing the query
   * @param readReplica Whether to use the read replica instance
   */
  async queryOne<T>(
    ctx: Context,
    resolveInfo: GraphQLResolveInfo,
    beforeQuery?: (builder: GraphORMBuilder) => GraphORMBuilder,
    readReplica?: boolean,
  ): Promise<T | null> {
    const res = await this.query<T>(ctx, resolveInfo, beforeQuery, readReplica);

    if (!res.length) {
      return null;
    }

    return res[0];
  }

  /**
   * Queries the database to fulfill a Partial GraphQL request
   * @param ctx GraphQL context of the request
   * @param resolveInfo GraphQL resolve info of the request
   * @param hierarchy Array of field names
   * @param beforeQuery A callback function that is called before executing the query
   * @param readReplica Whether to use the read replica instance
   */
  queryByHierarchy<T>(
    ctx: Context,
    resolveInfo: GraphQLResolveInfo,
    hierarchy: string[],
    beforeQuery?: (builder: GraphORMBuilder) => GraphORMBuilder,
    readReplica?: boolean,
  ): Promise<T[]> {
    const parsedInfo = parseResolveInfo(resolveInfo) as ResolveTree;
    if (parsedInfo) {
      return this.queryResolveTree(
        ctx,
        this.getFieldByHierarchy(parsedInfo, hierarchy),
        beforeQuery,
        readReplica,
      );
    }
    throw new Error('Resolve info is empty');
  }

  /**
   * Queries the database to fulfill a GraphQL request.
   * Response is returned in a Relay style pagination object.
   * @param ctx GraphQL context of the request
   * @param resolveInfo GraphQL resolve info of the request
   * @param hasPreviousPage Whether there is a previous page (used for PageInfo)
   * @param hasNextPage Whether there is a previous page (used for PageInfo)
   * @param nodeToCursor A function that creates a cursor from a node
   * @param beforeQuery A callback function that is called before executing the query
   * @param transformNodes Apply any transformation on the nodes before adding page info
   * @param readReplica Whether to use the read replica instance
   */
  async queryPaginated<T>(
    ctx: Context,
    resolveInfo: GraphQLResolveInfo,
    hasPreviousPage: (nodeSize: number) => boolean,
    hasNextPage: (nodeSize: number) => boolean,
    nodeToCursor: (node: T, index: number) => string,
    beforeQuery?: (builder: GraphORMBuilder) => GraphORMBuilder,
    transformNodes?: (nodes: T[]) => T[],
    readReplica?: boolean,
  ): Promise<Connection<T>> {
    const parsedInfo = parseResolveInfo(resolveInfo) as ResolveTree;
    if (parsedInfo) {
      const resolveTree = this.getPaginatedField(parsedInfo);
      let nodes = await this.queryResolveTree<T>(
        ctx,
        resolveTree,
        beforeQuery,
        readReplica,
      );
      const nodesSize = nodes.length;
      if (transformNodes) {
        nodes = transformNodes(nodes);
      }
      return this.nodesToConnection(
        nodes,
        nodesSize,
        hasPreviousPage,
        hasNextPage,
        nodeToCursor,
      );
    }
    throw new Error('Resolve info is empty');
  }

  /**
   * Queries the database to fulfill a GraphQL request.
   * Response is returned in a Relay style pagination object.
   * @param hasPreviousPage Whether there is a previous page (used for PageInfo)
   * @param hasNextPage Whether there is a previous page (used for PageInfo)
   * @param nodeToCursor A function that creates a cursor from a node
   * @param fetchData A callback function that is called before executing the query
   * @param transformNodes Apply any transformation on the nodes before adding page info
   */
  async queryPaginatedIntegration<T>(
    hasPreviousPage: (nodeSize: number) => boolean,
    hasNextPage: (nodeSize: number) => boolean,
    nodeToCursor: (node: T, index: number) => string,
    fetchData: () => Promise<T[]>,
    transformNodes?: (nodes: T[]) => T[],
  ): Promise<Connection<T>> {
    let nodes = await fetchData();
    const nodesSize = nodes.length;
    if (transformNodes) {
      nodes = transformNodes(nodes);
    }
    return this.nodesToConnection(
      nodes,
      nodesSize,
      hasPreviousPage,
      hasNextPage,
      nodeToCursor,
    );
  }
}
