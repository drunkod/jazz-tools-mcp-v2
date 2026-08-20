import styles from "./App.module.css";

export const LEGACY_DIRECT_CONNECTION_STORAGE_KEYS = [
  "jazz-inspector-standalone-config",
] as const;

/** Remove credentials left by the trusted direct-connection Inspector. */
export function removeLegacyDirectConnectionState(): void {
  if (typeof window === "undefined") return;

  for (const key of LEGACY_DIRECT_CONNECTION_STORAGE_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Storage may be unavailable or blocked; the production UI remains denied.
    }
  }

  if (window.location.hash) {
    try {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    } catch {
      // A restricted history API must not make the unavailable screen fail open.
    }
  }
}

// Run before React mounts so legacy URL/storage credentials are cleared as soon
// as the fail-closed production entry is evaluated.
removeLegacyDirectConnectionState();

export default function ProductionApp() {
  return (
    <main className={styles.statePage}>
      <section className={styles.stateCard} aria-labelledby="production-unavailable-title">
        <h1 id="production-unavailable-title" className={styles.stateTitle}>
          Inspector unavailable in production
        </h1>
        <p className={styles.errorText}>A trusted backend-for-frontend (BFF) is required.</p>
        <p className={styles.loadingText}>
          Direct browser administrator access is disabled. Deploy the authenticated, same-origin
          Admin BFF before enabling this Inspector.
        </p>
      </section>
    </main>
  );
}
