import { describe, it, expect } from "vitest";

interface ManifestEntry {
  id: string;
  currentStatus: string;
  productionPriority: string;
  sourcePath?: string;
  role?: string;
}

interface ReferenceSheet {
  section: string;
  reviewStatus: string;
}

function calculateStats(entries: ManifestEntry[]) {
  return {
    totalEntries: entries.length,
    verticalSlice: entries.filter((e) => e.productionPriority === "vertical-slice").length,
    phaseTwo: entries.filter((e) => e.productionPriority === "phase-two").length,
    approvedExisting: entries.filter((e) => e.currentStatus === "approved-existing").length,
    proceduralPlaceholder: entries.filter((e) => e.currentStatus === "procedural-placeholder").length,
    licensed: entries.filter((e) => e.currentStatus === "licensed-placeholder").length,
    missing: entries.filter((e) => e.currentStatus === "missing").length,
    needsAudit: entries.filter((e) => e.currentStatus === "needs-audit").length,
  };
}

function findBlockers(entries: ManifestEntry[]) {
  return entries.filter(
    (e) => e.currentStatus === "missing" || (e.currentStatus === "approved-existing" && !e.sourcePath)
  );
}

function groupByRole(entries: ManifestEntry[]) {
  return entries.reduce(
    (acc, entry) => {
      const role = entry.role || "unknown";
      if (!acc[role]) acc[role] = [];
      acc[role].push(entry);
      return acc;
    },
    {} as Record<string, ManifestEntry[]>
  );
}

function filterApprovedSheets(sheets: Record<string, ReferenceSheet>) {
  return Object.values(sheets).filter((s) => s.reviewStatus === "approved");
}

describe("Visual production workbench calculations", () => {
  it("calculates asset statistics correctly", () => {
    const entries: ManifestEntry[] = [
      { id: "a", currentStatus: "approved-existing", productionPriority: "vertical-slice" },
      { id: "b", currentStatus: "procedural-placeholder", productionPriority: "vertical-slice" },
      { id: "c", currentStatus: "missing", productionPriority: "phase-two" },
      { id: "d", currentStatus: "licensed-placeholder", productionPriority: "phase-two" },
      { id: "e", currentStatus: "needs-audit", productionPriority: "phase-two" },
    ];

    const stats = calculateStats(entries);
    expect(stats.totalEntries).toBe(5);
    expect(stats.verticalSlice).toBe(2);
    expect(stats.phaseTwo).toBe(3);
    expect(stats.approvedExisting).toBe(1);
    expect(stats.proceduralPlaceholder).toBe(1);
    expect(stats.licensed).toBe(1);
    expect(stats.missing).toBe(1);
    expect(stats.needsAudit).toBe(1);
  });

  it("identifies blockers: missing status", () => {
    const entries: ManifestEntry[] = [
      { id: "a", currentStatus: "missing", productionPriority: "vertical-slice" },
      { id: "b", currentStatus: "approved-existing", productionPriority: "vertical-slice", sourcePath: "/path" },
    ];

    const blockers = findBlockers(entries);
    expect(blockers).toHaveLength(1);
    if (blockers.length > 0) {
      expect(blockers[0]!.id).toBe("a");
    }
  });

  it("identifies blockers: approved-existing without sourcePath", () => {
    const entries: ManifestEntry[] = [
      { id: "a", currentStatus: "approved-existing", productionPriority: "vertical-slice", sourcePath: "/path" },
      { id: "b", currentStatus: "approved-existing", productionPriority: "vertical-slice" },
    ];

    const blockers = findBlockers(entries);
    expect(blockers).toHaveLength(1);
    if (blockers.length > 0) {
      expect(blockers[0]!.id).toBe("b");
    }
  });

  it("groups entries by role", () => {
    const entries: ManifestEntry[] = [
      { id: "a", role: "runtime-asset", currentStatus: "approved-existing", productionPriority: "vertical-slice" },
      { id: "b", role: "runtime-asset", currentStatus: "approved-existing", productionPriority: "vertical-slice" },
      { id: "c", role: "procedural-system", currentStatus: "procedural-placeholder", productionPriority: "phase-two" },
    ];

    const byRole = groupByRole(entries);
    expect(Object.keys(byRole)).toHaveLength(2);
    expect(byRole["runtime-asset"]).toHaveLength(2);
    expect(byRole["procedural-system"]).toHaveLength(1);
  });

  it("defaults unknown roles to 'unknown' key", () => {
    const entries: ManifestEntry[] = [
      { id: "a", currentStatus: "approved-existing", productionPriority: "vertical-slice" },
    ];

    const byRole = groupByRole(entries);
    expect(byRole["unknown"]).toHaveLength(1);
  });

  it("filters approved reference sheets", () => {
    const sheets: Record<string, ReferenceSheet> = {
      "01": { section: "01", reviewStatus: "approved" },
      "02": { section: "02", reviewStatus: "approved" },
      "06": { section: "06", reviewStatus: "awaiting-submission" },
    };

    const approved = filterApprovedSheets(sheets);
    expect(approved).toHaveLength(2);
    expect(approved.every((s) => s.reviewStatus === "approved")).toBe(true);
  });

  it("handles empty entries", () => {
    const stats = calculateStats([]);
    expect(stats.totalEntries).toBe(0);
    expect(stats.verticalSlice).toBe(0);
    expect(stats.phaseTwo).toBe(0);
  });

  it("handles empty reference sheets", () => {
    const approved = filterApprovedSheets({});
    expect(approved).toHaveLength(0);
  });
});
