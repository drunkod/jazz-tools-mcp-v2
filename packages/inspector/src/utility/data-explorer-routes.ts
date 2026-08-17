export type TableView = "data" | "schema";

/** Build a Data Explorer route from a runtime table name without treating data as URL syntax. */
export function tableViewPath(tableName: string, view: TableView): string {
  return `/data-explorer/${encodeURIComponent(tableName)}/${view}`;
}
