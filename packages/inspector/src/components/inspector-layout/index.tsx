import { NavLink, Outlet, useLocation } from "react-router";
import { useDevtoolsContext } from "../../contexts/devtools-context.js";
import { useStandaloneContext } from "../../contexts/standalone-context.js";
import {
  formatSchemaHashOptionLabel,
  type SchemaHashInfo,
} from "../../utility/schema-hash-display.js";
import { requestCloseOverlay } from "../../utility/overlay-settings.js";
import { useLocalStorageState } from "../../utility/use-local-storage-state.js";
import { Tooltip } from "../tooltip/Tooltip.js";
import styles from "./index.module.css";

const TABLES_PANEL_OPEN_STORAGE_KEY = "jazz.inspector.dataExplorer.tablesPanelOpen";

interface TablesPanelIconProps {
  direction: "open" | "close";
}

function TablesPanelIcon({ direction }: TablesPanelIconProps) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
      <path d="M6 3v10" />
      {direction === "close" ? <path d="M10 6l-2 2 2 2" /> : <path d="M8 6l2 2-2 2" />}
    </svg>
  );
}

function DatabaseIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.35"
      aria-hidden="true"
    >
      <ellipse cx="9" cy="4.25" rx="5.5" ry="2.25" />
      <path d="M3.5 4.25v4.5C3.5 10 6 11 9 11s5.5-1 5.5-2.25v-4.5" />
      <path d="M3.5 8.75v4.5C3.5 14.5 6 15.5 9 15.5s5.5-1 5.5-2.25v-4.5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function activeTableFromPathname(pathname: string): string | null {
  const [section, table] = pathname.split("/").filter(Boolean);
  if (section !== "data-explorer" || !table) return null;

  try {
    return decodeURIComponent(table);
  } catch {
    return table;
  }
}

function serverHost(serverUrl: string): string {
  try {
    return new URL(serverUrl).host;
  } catch {
    return serverUrl;
  }
}

function shortAppId(appId: string): string {
  if (appId.length <= 18) return appId;
  return `${appId.slice(0, 8)}…${appId.slice(-6)}`;
}

export function InspectorLayout() {
  const { runtime } = useDevtoolsContext();
  const isOverlay = runtime === "overlay";
  const standaloneContext = useStandaloneContext();
  const location = useLocation();
  const [isTablesPanelOpen, setIsTablesPanelOpen] = useLocalStorageState(
    TABLES_PANEL_OPEN_STORAGE_KEY,
    true,
  );

  const isDataExplorerRoute = location.pathname.startsWith("/data-explorer");
  const activeTable = activeTableFromPathname(location.pathname);
  const connection = standaloneContext?.connection;

  const onToggleTablesPanel = () => {
    setIsTablesPanelOpen((isOpen) => !isOpen);
  };

  return (
    <main className={styles.root}>
      <header className={styles.topBar}>
        <div className={styles.topBarPrimary}>
          <div className={styles.brand} aria-label="Jazz Admin">
            <span className={styles.brandIcon}>
              <DatabaseIcon />
            </span>
            <span className={styles.brandCopy}>
              <strong className={styles.brandTitle}>Jazz Admin</strong>
              <span className={styles.brandSubtitle}>{isOverlay ? "Dev overlay" : "Database console"}</span>
            </span>
          </div>

          <div className={styles.topBarDivider} aria-hidden="true" />

          <div className={styles.locationGroup}>
            <div className={styles.breadcrumbs} aria-label="Current database location">
              <span className={styles.breadcrumbMuted}>Database</span>
              {activeTable ? (
                <>
                  <span className={styles.breadcrumbSeparator}>/</span>
                  <strong className={styles.breadcrumbCurrent}>{activeTable}</strong>
                </>
              ) : null}
            </div>

            <nav className={styles.tabBar} aria-label="Inspector sections">
              {isDataExplorerRoute ? (
                <button
                  type="button"
                  onClick={onToggleTablesPanel}
                  className={styles.iconButton}
                  aria-label={isTablesPanelOpen ? "Collapse tables panel" : "Expand tables panel"}
                  aria-pressed={isTablesPanelOpen}
                >
                  <TablesPanelIcon direction={isTablesPanelOpen ? "close" : "open"} />
                </button>
              ) : null}
              <NavLink
                to="/data-explorer"
                className={({ isActive }) =>
                  `${styles.tabLink} ${isActive ? styles.tabLinkActive : ""}`
                }
              >
                Data Explorer
              </NavLink>
              <NavLink
                to="/live-query"
                className={({ isActive }) =>
                  `${styles.tabLink} ${isActive ? styles.tabLinkActive : ""}`
                }
              >
                Subscriptions
              </NavLink>
              {isOverlay ? (
                <NavLink
                  to="/settings"
                  className={({ isActive }) =>
                    `${styles.tabLink} ${isActive ? styles.tabLinkActive : ""}`
                  }
                >
                  Settings
                </NavLink>
              ) : null}
            </nav>
          </div>
        </div>

        <div className={styles.topBarActions}>
          {connection ? (
            <div
              className={styles.liveConnection}
              aria-label="Jazz connection configuration"
              title={`${serverHost(connection.serverUrl)} · ${connection.appId}`}
            >
              <span className={styles.liveLabel}>Jazz</span>
              <span className={styles.connectionApp}>{shortAppId(connection.appId)}</span>
            </div>
          ) : null}

          {standaloneContext ? (
            <>
              <SchemaHashesSelect
                schemaHashes={standaloneContext.schemaHashes}
                selectedSchemaHash={standaloneContext.selectedSchemaHash}
                onSelectSchema={standaloneContext.onSelectSchema}
                isSwitchingSchema={standaloneContext.isSwitchingSchema}
              />
              <button
                type="button"
                onClick={standaloneContext.onManageConnections}
                className={styles.resetButton}
              >
                Connections
              </button>
            </>
          ) : null}
          {isOverlay ? (
            <Tooltip label="Close (Esc)">
              <button
                type="button"
                onClick={requestCloseOverlay}
                className={styles.iconButton}
                aria-label="Close inspector"
              >
                <CloseIcon />
              </button>
            </Tooltip>
          ) : null}
        </div>
      </header>
      <section className={styles.content}>
        <Outlet context={{ isTablesPanelOpen }} />
      </section>
    </main>
  );
}

interface SchemaHashesSelectProps {
  schemaHashes: SchemaHashInfo[];
  selectedSchemaHash: string | null;
  onSelectSchema: (schemaHash: string) => void;
  isSwitchingSchema: boolean;
}

export function SchemaHashesSelect({
  schemaHashes,
  selectedSchemaHash,
  onSelectSchema,
  isSwitchingSchema,
}: SchemaHashesSelectProps) {
  return (
    <label className={styles.schemaSelectLabel}>
      <span className={styles.schemaLabelText}>Schema</span>
      <select
        className={styles.schemaSelect}
        value={selectedSchemaHash ?? ""}
        onChange={(event) => onSelectSchema(event.target.value)}
        disabled={isSwitchingSchema || schemaHashes.length === 0}
      >
        {schemaHashes.map((schema) => (
          <option key={schema.hash} value={schema.hash} title={schema.hash}>
            {formatSchemaHashOptionLabel(schema)}
          </option>
        ))}
      </select>
    </label>
  );
}
