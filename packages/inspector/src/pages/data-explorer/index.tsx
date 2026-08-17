import { useEffect, useMemo, useState } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { NavLink, Outlet, useNavigate, useOutletContext, useParams } from "react-router";
import { useDevtoolsContext } from "../../contexts/devtools-context.js";
import { useLocalStorageState } from "../../utility/use-local-storage-state.js";
import styles from "./index.module.css";

const TABLES_SIDEBAR_SIZE_STORAGE_KEY = "jazz.inspector.dataExplorer.tablesSidebarSize";
const TABLES_SIDEBAR_DEFAULT_SIZE = 16;
const TABLES_SIDEBAR_MIN_SIZE = 10;
const TABLES_SIDEBAR_MAX_SIZE = 30;

type TableView = "data" | "schema";

interface DataExplorerOutletContext {
  isTablesPanelOpen: boolean;
}

interface TableNavigationItem {
  name: string;
  columnCount: number;
}

function tablePath(tableName: string, view: TableView): string {
  return `/data-explorer/${encodeURIComponent(tableName)}/${view}`;
}

function isTablesSidebarSize(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= TABLES_SIDEBAR_MIN_SIZE &&
    value <= TABLES_SIDEBAR_MAX_SIZE
  );
}

function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="4" />
      <path d="m10 10 3 3" />
    </svg>
  );
}

function TableIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      aria-hidden="true"
    >
      <rect x="2.5" y="3" width="11" height="10" rx="1.25" />
      <path d="M2.5 6.25h11M6.25 6.25V13" />
    </svg>
  );
}

function SchemaIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 3.5h6M5 8h6M5 12.5h6" />
      <circle cx="3" cy="3.5" r=".75" />
      <circle cx="3" cy="8" r=".75" />
      <circle cx="3" cy="12.5" r=".75" />
    </svg>
  );
}

interface TablesSidebarProps {
  tables: TableNavigationItem[];
  selectedTableName?: string;
}

function TablesSidebar({ tables, selectedTableName }: TablesSidebarProps) {
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLowerCase();
  const visibleTables = useMemo(
    () =>
      normalizedSearch.length === 0
        ? tables
        : tables.filter((table) => table.name.toLowerCase().includes(normalizedSearch)),
    [normalizedSearch, tables],
  );

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <div>
          <h2 className={styles.sidebarTitle}>Database</h2>
          <p className={styles.sidebarMeta}>
            {tables.length} table{tables.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <label className={styles.searchBox}>
        <span className={styles.searchIcon}>
          <SearchIcon />
        </span>
        <input
          className={styles.searchInput}
          aria-label="Search tables"
          placeholder="Search tables..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {search ? (
          <button
            type="button"
            className={styles.clearSearchButton}
            aria-label="Clear table search"
            onClick={() => setSearch("")}
          >
            ×
          </button>
        ) : null}
      </label>

      <div className={styles.objectSectionHeader}>
        <span>Tables</span>
        <span>{visibleTables.length}</span>
      </div>

      {visibleTables.length > 0 ? (
        <ul className={styles.tableList}>
          {visibleTables.map((table) => {
            const isSelected = selectedTableName === table.name;
            return (
              <li key={table.name} className={styles.tableListItem}>
                <div className={`${styles.tableRow} ${isSelected ? styles.tableRowActive : ""}`}>
                  <NavLink
                    to={tablePath(table.name, "data")}
                    className={styles.tableLink}
                    aria-label={`View ${table.name} data`}
                  >
                    <span className={styles.tableIcon}>
                      <TableIcon />
                    </span>
                    <span className={styles.tableName}>{table.name}</span>
                    <span
                      className={styles.columnCount}
                      title={`${table.columnCount} column${table.columnCount === 1 ? "" : "s"}`}
                    >
                      {table.columnCount}
                    </span>
                  </NavLink>
                  <NavLink
                    to={tablePath(table.name, "schema")}
                    className={({ isActive }) =>
                      `${styles.schemaLink} ${isActive ? styles.schemaLinkActive : ""}`
                    }
                    aria-label={`View ${table.name} schema`}
                    title={`${table.name} schema`}
                  >
                    <SchemaIcon />
                  </NavLink>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className={styles.noMatches}>
          <span>No tables match</span>
          <strong>{search}</strong>
        </div>
      )}

      <div className={styles.sidebarFooter}>
        <span className={styles.realtimeDot} aria-hidden="true" />
        <span>Reactive table data</span>
        <span className={styles.realtimeState}>Jazz</span>
      </div>
    </aside>
  );
}

export function DataExplorer() {
  const { wasmSchema: schema } = useDevtoolsContext();
  const isTablesPanelOpen =
    useOutletContext<DataExplorerOutletContext | null>()?.isTablesPanelOpen ?? true;
  const { table } = useParams();
  const navigate = useNavigate();

  const tables = useMemo<TableNavigationItem[]>(
    () =>
      Object.entries(schema ?? {})
        .map(([name, tableDefinition]) => ({
          name,
          columnCount: tableDefinition.columns.length,
        }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    [schema],
  );
  const tableNames = useMemo(() => tables.map((entry) => entry.name), [tables]);

  // Keep the explorer on a valid runtime table. This also recovers cleanly after
  // switching to a schema version that no longer contains the previously open table.
  useEffect(() => {
    if (tableNames.length === 0) return;
    if (!table || !tableNames.includes(table)) {
      navigate(tablePath(tableNames[0], "data"), { replace: true });
    }
  }, [table, tableNames, navigate]);

  const [tablesSidebarSize, setTablesSidebarSize] = useLocalStorageState(
    TABLES_SIDEBAR_SIZE_STORAGE_KEY,
    TABLES_SIDEBAR_DEFAULT_SIZE,
    { isValid: isTablesSidebarSize },
  );

  return (
    <Group
      key={isTablesPanelOpen ? "tables-panel-open" : "tables-panel-closed"}
      className={styles.layout}
      orientation="horizontal"
      onLayoutChanged={(layout) => {
        const nextTablesSidebarSize = layout["tables-panel"];
        if (isTablesSidebarSize(nextTablesSidebarSize)) {
          setTablesSidebarSize(nextTablesSidebarSize);
        }
      }}
    >
      {isTablesPanelOpen ? (
        <>
          <Panel
            id="tables-panel"
            className={styles.sidebarPanel}
            defaultSize={`${tablesSidebarSize}%`}
            minSize={`${TABLES_SIDEBAR_MIN_SIZE}%`}
            maxSize={`${TABLES_SIDEBAR_MAX_SIZE}%`}
          >
            <TablesSidebar tables={tables} selectedTableName={table} />
          </Panel>
          <Separator className={styles.resizeHandle} />
        </>
      ) : null}
      <Panel
        id="data-explorer-content"
        className={styles.contentPanel}
        defaultSize={isTablesPanelOpen ? undefined : "100%"}
        minSize={isTablesPanelOpen ? "40%" : "100%"}
      >
        <main className={styles.content}>
          {!table && tableNames.length === 0 ? (
            <section className={styles.emptyState}>
              <h3 className={styles.emptyTitle}>No tables</h3>
              <p className={styles.emptyText}>This schema doesn’t define any tables yet.</p>
            </section>
          ) : null}
          <Outlet />
        </main>
      </Panel>
    </Group>
  );
}
