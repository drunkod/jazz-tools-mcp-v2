import {
  getSupportedWhereOperatorsForSchemaColumn,
  type DynamicTableRow,
  type QueryBuilder,
  type TableProxy,
  type WasmSchema,
  type WhereOperator,
} from "jazz-tools";

export type GenericWhereInput = Record<string, unknown>;

export interface OrderByInput {
  column: string;
  direction?: "asc" | "desc";
}

const MAGIC_QUERY_COLUMNS = [
  "$canRead",
  "$canEdit",
  "$canDelete",
  "$createdBy",
  "$createdAt",
  "$updatedBy",
  "$updatedAt",
] as const;

const MAGIC_COLUMN_OPERATORS: Record<(typeof MAGIC_QUERY_COLUMNS)[number], readonly WhereOperator[]> = {
  $canRead: ["eq", "ne", "in"],
  $canEdit: ["eq", "ne", "in"],
  $canDelete: ["eq", "ne", "in"],
  $createdBy: ["eq", "ne", "contains", "in"],
  $createdAt: ["eq", "ne", "gt", "gte", "lt", "lte", "in"],
  $updatedBy: ["eq", "ne", "contains", "in"],
  $updatedAt: ["eq", "ne", "gt", "gte", "lt", "lte", "in"],
};

/**
 * Dynamic QueryBuilder adapted from the official Jazz Inspector's
 * `GenericQueryBuilder`. It intentionally uses Jazz's normal query JSON shape
 * instead of translating MCP requests into SQL.
 */
export class GenericQueryBuilder implements QueryBuilder<DynamicTableRow> {
  readonly _table: string;
  readonly _schema: WasmSchema;
  readonly _rowType: DynamicTableRow = undefined as unknown as DynamicTableRow;

  private conditions: Array<{ column: string; op: string; value: unknown }> = [];
  private selectColumns: string[] = [];
  private orderBys: Array<[string, "asc" | "desc"]> = [];
  private limitValue: number | undefined;
  private offsetValue: number | undefined;

  constructor(tableName: string, schema: WasmSchema) {
    this._table = tableName;
    this._schema = schema;
  }

  where(input: GenericWhereInput): GenericQueryBuilder {
    const clone = this.clone();
    for (const [column, value] of Object.entries(input)) {
      if (value === undefined) continue;
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value) &&
        Object.getPrototypeOf(value) === Object.prototype
      ) {
        for (const [op, opValue] of Object.entries(value as Record<string, unknown>)) {
          if (opValue !== undefined) clone.conditions.push({ column, op, value: opValue });
        }
      } else {
        clone.conditions.push({ column, op: "eq", value });
      }
    }
    return clone;
  }

  select(columns: string[]): GenericQueryBuilder {
    const clone = this.clone();
    clone.selectColumns = [...columns];
    return clone;
  }

  orderBy(items: OrderByInput[]): GenericQueryBuilder {
    const clone = this.clone();
    clone.orderBys = items.map(({ column, direction }) => [column, direction ?? "asc"]);
    return clone;
  }

  limit(value: number): GenericQueryBuilder {
    const clone = this.clone();
    clone.limitValue = value;
    return clone;
  }

  offset(value: number): GenericQueryBuilder {
    const clone = this.clone();
    clone.offsetValue = value;
    return clone;
  }

  _build(): string {
    return JSON.stringify({
      table: this._table,
      conditions: this.conditions,
      includes: {},
      select: this.selectColumns,
      orderBy: this.orderBys,
      limit: this.limitValue,
      offset: this.offsetValue,
      hops: [],
    });
  }

  private clone(): GenericQueryBuilder {
    const clone = new GenericQueryBuilder(this._table, this._schema);
    clone.conditions = [...this.conditions];
    clone.selectColumns = [...this.selectColumns];
    clone.orderBys = [...this.orderBys];
    clone.limitValue = this.limitValue;
    clone.offsetValue = this.offsetValue;
    return clone;
  }
}

export function dynamicTableProxy(
  tableName: string,
  schema: WasmSchema,
): TableProxy<DynamicTableRow, Record<string, unknown>> {
  return {
    _table: tableName,
    _schema: schema,
    _rowType: undefined as unknown as DynamicTableRow,
    _initType: undefined as unknown as Record<string, unknown>,
  };
}

export function assertTable(schema: WasmSchema, tableName: string): void {
  if (!schema[tableName]) {
    throw new Error(`Unknown Jazz table: ${tableName}`);
  }
}

export function assertQueryableColumns(
  schema: WasmSchema,
  tableName: string,
  columns: string[],
): void {
  assertTable(schema, tableName);
  const allowed = new Set([
    "id",
    ...schema[tableName]!.columns.map((column) => column.name),
    ...MAGIC_QUERY_COLUMNS,
  ]);
  const unknown = columns.filter((column) => !allowed.has(column));
  if (unknown.length > 0) {
    throw new Error(`Unknown query column(s) on ${tableName}: ${unknown.join(", ")}`);
  }
}

export function assertOrderByColumns(
  schema: WasmSchema,
  tableName: string,
  columns: string[],
): void {
  assertQueryableColumns(schema, tableName, columns);

  const unsupported = columns.filter((columnName) => {
    if (columnName === "id" || MAGIC_QUERY_COLUMNS.includes(columnName as never)) {
      return false;
    }
    const column = schema[tableName]!.columns.find((item) => item.name === columnName);
    return column?.column_type.type === "Bytea" || column?.column_type.type === "Json";
  });

  if (unsupported.length > 0) {
    throw new Error(
      `Jazz orderBy does not support Bytea/Json column(s) on ${tableName}: ${unsupported.join(", ")}`,
    );
  }
}

export function assertWritableColumns(
  schema: WasmSchema,
  tableName: string,
  columns: string[],
): void {
  assertTable(schema, tableName);
  const allowed = new Set(schema[tableName]!.columns.map((column) => column.name));
  const invalid = columns.filter((column) => !allowed.has(column));
  if (invalid.length > 0) {
    throw new Error(
      `Unknown or non-writable column(s) on ${tableName}: ${invalid.join(", ")}`,
    );
  }
}

export function assertWhereInput(
  schema: WasmSchema,
  tableName: string,
  where: GenericWhereInput | undefined,
): void {
  if (!where) return;
  assertQueryableColumns(schema, tableName, Object.keys(where));

  for (const [fieldName, value] of Object.entries(where)) {
    if (value === undefined) continue;
    const supported = supportedWhereOperators(schema, tableName, fieldName);
    if (!supported) {
      throw new Error(`Column ${tableName}.${fieldName} does not support where predicates`);
    }

    const requestedOperators =
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) === Object.prototype
        ? Object.keys(value as Record<string, unknown>)
        : ["eq"];

    const invalid = requestedOperators.filter(
      (operator) => !supported.includes(operator as WhereOperator),
    );
    if (invalid.length > 0) {
      throw new Error(
        `Unsupported where operator(s) for ${tableName}.${fieldName}: ${invalid.join(", ")}. ` +
          `Supported: ${supported.join(", ")}`,
      );
    }
  }
}

function supportedWhereOperators(
  schema: WasmSchema,
  tableName: string,
  fieldName: string,
): readonly WhereOperator[] | undefined {
  if (fieldName in MAGIC_COLUMN_OPERATORS) {
    return MAGIC_COLUMN_OPERATORS[fieldName as keyof typeof MAGIC_COLUMN_OPERATORS];
  }

  const column = schema[tableName]!.columns.find((item) => item.name === fieldName);
  return getSupportedWhereOperatorsForSchemaColumn(fieldName, column);
}
