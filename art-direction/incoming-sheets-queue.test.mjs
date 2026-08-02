import { test } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, "..");
const queuePath = resolve(__dirname, "incoming-sheets-queue.json");

let queue;
try {
  queue = JSON.parse(readFileSync(queuePath, "utf8"));
} catch (e) {
  console.error("Failed to load queue:", e.message);
  process.exit(1);
}

// GATE 12 TESTS - Incoming sheets queue

test("Incoming queue: file loads successfully", () => {
  assert.ok(queue.version, "Queue has version");
  assert.ok(queue.queue, "Queue has queue array");
  assert.ok(Array.isArray(queue.queue), "Queue is an array");
  assert.ok(queue.processingRules, "Queue has processing rules");
  assert.ok(queue.summary, "Queue has summary");
});

test("Incoming queue: sections 11-20 are defined", () => {
  assert.equal(queue.queue.length, 10, "Exactly 10 sections in queue");
  const sections = queue.queue.map((q) => q.section);
  const expectedSections = ["11", "12", "13", "14", "15", "16", "17", "18", "19", "20"];
  assert.deepEqual(sections, expectedSections, "Sections 11-20 are in order");
});

test("Incoming queue: each section has required structure", () => {
  const requiredFields = [
    "section",
    "name",
    "priority",
    "submissionStatus",
    "received",
    "receivedDate",
    "assignedTo",
    "requirements",
    "blockers",
  ];

  for (const item of queue.queue) {
    for (const field of requiredFields) {
      assert.ok(item[field] !== undefined, `Section ${item.section} has ${field}`);
    }
  }
});

test("Incoming queue: sections 11-18 are assigned", () => {
  for (let i = 0; i < 8; i++) {
    const item = queue.queue[i];
    assert.ok(item.assignedTo, `Section ${item.section} is assigned to a team`);
    assert.notEqual(item.assignedTo, null, `Section ${item.section} assignment is not null`);
  }
});

test("Incoming queue: sections 19-20 are reserved", () => {
  const reserved19 = queue.queue[8];
  const reserved20 = queue.queue[9];

  assert.ok(reserved19.name.includes("RESERVED"), "Section 19 is marked reserved");
  assert.ok(reserved20.name.includes("RESERVED"), "Section 20 is marked reserved");
  assert.equal(reserved19.submissionStatus, "awaiting-definition", "Section 19 awaits definition");
  assert.equal(reserved20.submissionStatus, "awaiting-definition", "Section 20 awaits definition");
});

test("Incoming queue: phase assignments are valid", () => {
  const phases = ["phase-two", "phase-three", "future"];
  for (const item of queue.queue) {
    assert.ok(phases.includes(item.priority), `Section ${item.section} has valid priority`);
  }
});

test("Incoming queue: expected entries are defined for active sections", () => {
  for (let i = 0; i < 8; i++) {
    const item = queue.queue[i];
    assert.ok(Array.isArray(item.expectedEntries), `Section ${item.section} has expected entries`);
    assert.ok(item.expectedEntries.length > 0, `Section ${item.section} has at least one expected entry`);
  }
});

test("Incoming queue: requirements are detailed", () => {
  for (let i = 0; i < 8; i++) {
    const item = queue.queue[i];
    const req = item.requirements;
    assert.ok(req.assetCount, `Section ${item.section} has asset count range`);
    assert.ok(req.categories, `Section ${item.section} has categories`);
    assert.ok(req.resolutions, `Section ${item.section} has resolutions`);
    assert.ok(Array.isArray(req.categories), `Section ${item.section} categories is array`);
  }
});

test("Incoming queue: blockers are tracked", () => {
  for (const item of queue.queue) {
    assert.ok(Array.isArray(item.blockers), `Section ${item.section} has blockers array`);
  }
});

test("Incoming queue: timeline is coherent", () => {
  const timeline = queue.timeline;
  assert.ok(timeline["phase-two"], "Timeline has phase-two");
  assert.ok(timeline["phase-three"], "Timeline has phase-three");
  assert.ok(timeline["future"], "Timeline has future");

  assert.equal(timeline["phase-two"].sections.length, 6, "Phase-two has 6 sections");
  assert.equal(timeline["phase-three"].sections.length, 2, "Phase-three has 2 sections");
  assert.equal(timeline["future"].sections.length, 2, "Future has 2 sections");
});

test("Incoming queue: summary statistics are accurate", () => {
  const summary = queue.summary;
  assert.equal(summary.totalSections, 10, "Summary reports 10 total sections");
  assert.equal(summary.definedSections, 8, "Summary reports 8 defined sections");
  assert.equal(summary.reservedSections, 2, "Summary reports 2 reserved sections");
  assert.equal(summary.submittedSections, 0, "Summary reports 0 submitted");
  assert.equal(summary.approvedSections, 0, "Summary reports 0 approved");
});

test("Incoming queue: submission status is awaiting for active sections", () => {
  for (let i = 0; i < 8; i++) {
    const item = queue.queue[i];
    assert.equal(item.submissionStatus, "awaiting-submission", `Section ${item.section} awaits submission`);
    assert.equal(item.received, false, `Section ${item.section} not yet received`);
  }
});

test("Incoming queue: processing rules are reasonable", () => {
  const rules = queue.processingRules;
  assert.ok(rules.submissionDeadline, "Deadline is set");
  assert.ok(rules.reviewCycle, "Review cycle is defined");
  assert.ok(rules.maxSectionBatch > 0, "Max batch size is positive");
});

console.log("\n✅ All incoming queue tests passed!");
