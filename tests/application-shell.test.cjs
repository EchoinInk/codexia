const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { load, root } = require("./load-typescript.cjs");

const navigation = load(path.join(root, "lib/application-shell/navigation.ts"));
const shellSource = fs.readFileSync(path.join(root, "components/application-shell/ApplicationShell.tsx"), "utf8");
const commandSource = fs.readFileSync(path.join(root, "components/application-shell/CommandPalette.tsx"), "utf8");
const pageSource = fs.readFileSync(path.join(root, "app/page.tsx"), "utf8");

test("WP9.2: canonical shell routes are stable, searchable, and reject unknown URL state", () => {
  assert.deepEqual(navigation.shellRoutes.map(route => route.id), ["chat", "files", "intelligence", "operations", "settings"]);
  assert.equal(navigation.shellViewFromSearch("?view=operations"), "operations");
  assert.equal(navigation.shellViewFromSearch("?view=unknown"), "chat");
  assert.equal(navigation.searchShellRoutes("diagnostics")[0].id, "intelligence");
  assert.equal(navigation.searchShellRoutes("runtime")[0].id, "operations");
});

test("WP9.2: application shell owns responsive navigation, URL state, and command focus behavior", () => {
  assert.match(shellSource, /aria-label="Global navigation"/);
  assert.match(shellSource, /aria-current=\{active \? "page"/);
  assert.match(shellSource, /window\.history\.pushState/);
  assert.match(shellSource, /window\.addEventListener\("popstate"/);
  assert.match(shellSource, /event\.metaKey \|\| event\.ctrlKey/);
  assert.match(shellSource, /lg:translate-x-0/);
  assert.match(commandSource, /aria-modal="true"/);
  assert.match(commandSource, /event\.key === "Escape"/);
  assert.match(commandSource, /event\.key !== "Tab"/);
});

test("WP9.2: shell consumes the existing workspace projection and preserves screen slots", () => {
  assert.match(pageSource, /fetch\("\/api\/workspaces"/);
  assert.match(pageSource, /<WorkspaceIntelligence active=/);
  assert.match(pageSource, /<WorkspaceOperations active=/);
  assert.match(pageSource, /<Chat engineering=/);
  assert.match(pageSource, /<ShellPanel className="h-full">/);
  assert.doesNotMatch(shellSource, /\/api\/engineering|\/api\/fs\/write/);
});
