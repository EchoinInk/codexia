const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const component = fs.readFileSync(
  path.join(root, "components/WorkspaceIntelligence.tsx"),
  "utf8"
);
const page = fs.readFileSync(path.join(root, "app/page.tsx"), "utf8");
const sidebar = fs.readFileSync(
  path.join(root, "components/Sidebar.tsx"),
  "utf8"
);

test("workspace intelligence UI preserves the aggregate status contract", () => {
  for (const status of ["current", "stale", "incomplete", "unavailable", "failed"]) {
    assert.match(component, new RegExp(`\\b${status}\\b`));
  }
  assert.match(component, /\/api\/intelligence\/workspace/);
  assert.match(component, /cache:\s*"no-store"/);
  assert.doesNotMatch(component, /setInterval/);
  assert.doesNotMatch(component, /setTimeout/);
  assert.match(component, /if \(!active\) return/);
  assert.match(component, /Read-only insight/);
  assert.match(component, /Project evolution/);
  assert.match(component, /Learned patterns/);
  assert.match(component, /Evidence snapshot/);
  assert.match(component, /Evidence IDs/);
  assert.match(component, /historical/);
  assert.match(component, /invalidated/);
  assert.match(component, /Neither changes workspace freshness/);
  assert.match(component, /Engineering priorities/);
  assert.match(component, /Deterministic advisory attention ordering/);
  assert.match(component, /do not approve, propose, fix, or execute work/);
  assert.match(component, /priorityFactors/);
  assert.match(component, /contradictions/);
  assert.doesNotMatch(component, /Fix automatically/);
  assert.doesNotMatch(component, /Approve priority/);
});

test("workspace intelligence is exposed as a responsive application view", () => {
  assert.match(sidebar, /intelligence/);
  assert.match(sidebar, /Activity/);
  assert.match(page, /WorkspaceIntelligence/);
  assert.match(page, /active=\{view === "intelligence"\}/);
  assert.match(component, /sm:grid-cols-2/);
  assert.match(component, /lg:grid-cols-2/);
});
