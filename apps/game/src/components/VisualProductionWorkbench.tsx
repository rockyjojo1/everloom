import { useEffect, useState } from "react";
import styles from "./VisualProductionWorkbench.module.css";

interface ManifestEntry {
  id: string;
  name: string;
  currentStatus: string;
  productionPriority: string;
  worldAssetId?: string;
  sourcePath?: string;
  boardSection?: string;
  role?: string;
}

interface Manifest {
  entries: ManifestEntry[];
}

interface ReferenceSheet {
  id: string;
  section: string;
  received: boolean;
  reviewStatus: string;
  approvedDate?: string;
  checksum?: string;
  width?: number;
  height?: number;
}

interface RegistryStatus {
  sheets: Record<string, ReferenceSheet>;
  summary: {
    total: number;
    approved: number;
    awaiting: number;
  };
}

export function VisualProductionWorkbench() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [registry, setRegistry] = useState<RegistryStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/art-direction/visual-production-manifest.json").then((r) => r.json()),
      fetch("/art-direction/scripts/registry.json").then((r) => r.json()),
    ])
      .then(([manifestData, registryData]) => {
        setManifest(manifestData);
        setRegistry(registryData);
      })
      .catch((err) => {
        setError(`Failed to load data: ${err.message}`);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className={styles.workbench}>
        <section className={styles.loading}>
          <div className="loom-mark" />
          <p>Loading production workbench…</p>
        </section>
      </main>
    );
  }

  if (error || !manifest || !registry) {
    return (
      <main className={styles.workbench}>
        <section className={styles.error}>
          <h1>⚠️ Workbench Error</h1>
          <p>{error || "Failed to load manifest or registry"}</p>
        </section>
      </main>
    );
  }

  // Calculate statistics
  const stats = {
    totalEntries: manifest.entries.length,
    verticalSlice: manifest.entries.filter((e) => e.productionPriority === "vertical-slice").length,
    phaseTwo: manifest.entries.filter((e) => e.productionPriority === "phase-two").length,
    approvedExisting: manifest.entries.filter((e) => e.currentStatus === "approved-existing").length,
    proceduralPlaceholder: manifest.entries.filter((e) => e.currentStatus === "procedural-placeholder").length,
    licensed: manifest.entries.filter((e) => e.currentStatus === "licensed-placeholder").length,
    missing: manifest.entries.filter((e) => e.currentStatus === "missing").length,
    needsAudit: manifest.entries.filter((e) => e.currentStatus === "needs-audit").length,
  };

  // Find blockers
  const blockers = manifest.entries.filter(
    (e) => e.currentStatus === "missing" || (e.currentStatus === "approved-existing" && !e.sourcePath)
  );

  // Group by role
  const byRole = manifest.entries.reduce(
    (acc, entry) => {
      const role = entry.role || "unknown";
      if (!acc[role]) acc[role] = [];
      acc[role].push(entry);
      return acc;
    },
    {} as Record<string, ManifestEntry[]>
  );

  return (
    <main className={styles.workbench}>
      <header className={styles.header}>
        <h1>🎨 Visual Production Workbench</h1>
        <p>Asset pipeline status, reference sheets, and manifest inventory</p>
      </header>

      <section className={styles.section}>
        <h2>Asset Inventory Summary</h2>
        <div className={styles.grid}>
          <div className={styles.stat}>
            <span className={styles.label}>Total Entries</span>
            <span className={styles.value}>{stats.totalEntries}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.label}>Vertical-Slice</span>
            <span className={styles.value}>{stats.verticalSlice}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.label}>Phase-Two</span>
            <span className={styles.value}>{stats.phaseTwo}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.label}>Approved-Existing</span>
            <span className={styles.value}>{stats.approvedExisting}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.label}>Procedural</span>
            <span className={styles.value}>{stats.proceduralPlaceholder}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.label}>Licensed</span>
            <span className={styles.value}>{stats.licensed}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.label}>Missing</span>
            <span className={styles.value}>{stats.missing}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.label}>Needs Audit</span>
            <span className={styles.value}>{stats.needsAudit}</span>
          </div>
        </div>
      </section>

      {blockers.length > 0 && (
        <section className={styles.section + " " + styles.blocker}>
          <h2>🚫 Current Blockers</h2>
          <ul>
            {blockers.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.id}</strong> ({entry.currentStatus})
                {!entry.sourcePath && " — missing source path"}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.section}>
        <h2>Reference Sheets (Sections 01-10)</h2>
        <div className={styles.sheetsGrid}>
          {Object.entries(registry.sheets)
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(0, 10)
            .map(([id, sheet]) => (
              <div
                key={id}
                className={`${styles.sheetCard} ${sheet.reviewStatus === "approved" ? styles.approved : styles.awaiting}`}
              >
                <div className={styles.sheetHeader}>
                  <h3>Section {sheet.section}</h3>
                  <span className={styles.status}>{sheet.reviewStatus}</span>
                </div>
                <div className={styles.sheetDetails}>
                  {sheet.width && sheet.height && (
                    <p>
                      Dimensions: {sheet.width}×{sheet.height}
                    </p>
                  )}
                  {sheet.checksum && (
                    <p className={styles.checksum}>SHA-256: {sheet.checksum.substring(0, 16)}…</p>
                  )}
                  {sheet.approvedDate && <p>Approved: {sheet.approvedDate}</p>}
                </div>
              </div>
            ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Entries by Role</h2>
        <div className={styles.roleTable}>
          <table>
            <thead>
              <tr>
                <th>Role</th>
                <th>Count</th>
                <th>Examples</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(byRole)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([role, entries]) => (
                  <tr key={role}>
                    <td className={styles.roleCell}>{role}</td>
                    <td>{entries.length}</td>
                    <td className={styles.examples}>
                      {entries
                        .slice(0, 3)
                        .map((e) => e.id)
                        .join(", ")}
                      {entries.length > 3 && "…"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Sample Approved Assets</h2>
        <div className={styles.assetTable}>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Source Path</th>
              </tr>
            </thead>
            <tbody>
              {manifest.entries
                .filter((e) => e.currentStatus === "approved-existing")
                .slice(0, 15)
                .map((entry) => (
                  <tr key={entry.id}>
                    <td className={styles.idCell}>{entry.id}</td>
                    <td>{entry.currentStatus}</td>
                    <td>{entry.productionPriority}</td>
                    <td className={styles.path}>{entry.sourcePath || "—"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className={styles.footer}>
        <p>Development-only visual production dashboard. Not visible in production builds.</p>
        <p>
          <a href="?">← Return to game</a>
        </p>
      </footer>
    </main>
  );
}
