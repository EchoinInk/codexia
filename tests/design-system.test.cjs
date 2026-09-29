const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { load, root } = require("./load-typescript.cjs");

const tokens = load(path.join(root, "lib/design-system/tokens.ts"));
const assets = load(path.join(root, "lib/design-system/assets.ts"));
const status = load(path.join(root, "lib/design-system/status.ts"));

test("WP9.1: Nebula palette and restrained Codier accent are canonical", () => {
  assert.deepEqual(tokens.nebulaPalette, {
    ink: "#050B1B", deepOrbit: "#09142B", orbit: "#0E1C38", cosmicSlate: "#172A4D",
    stellarSlate: "#526A98", starlight: "#F5F7FF", moonlight: "#C9D4F3", periwinkle: "#6F78F4",
    lavender: "#A78BFA", auroraViolet: "#7E58FF", ionCyan: "#35D9F2", cosmicBlue: "#4285F4",
    codierMagenta: "#FF63D8", codierPink: "#FF8FDB", success: "#42D6A4", warning: "#F6B95E", danger: "#FF647C",
  });
  assert.equal(tokens.codierAccents.primary, tokens.nebulaPalette.auroraViolet);
  assert.match(tokens.codierAccents.usage, /restrained.*never dominant/i);
  for (const family of ["typography", "spacing", "radii", "borders", "elevation", "gradients", "statusSemantics", "agentStates"]) {
    assert.ok(Object.keys(tokens[family]).length, `${family} must be populated`);
  }
});

test("WP9.1: product state names resolve through one semantic status mapping", () => {
  assert.equal(status.evidenceStatusSemantic("current"), "success");
  assert.equal(status.evidenceStatusSemantic("stale"), "warning");
  assert.equal(status.evidenceStatusSemantic("incomplete"), "info");
  assert.equal(status.evidenceStatusSemantic("invalidated"), "danger");
  assert.equal(status.evidenceStatusSemantic("unavailable"), "neutral");
  assert.match(status.evidenceStatusClassName("failed", true), /status-danger/);
});

test("WP9.1: registry entries point to copied canonical production assets", () => {
  const publicRoot = path.join(root, "public");
  const registered = [
    ...Object.values(assets.codexiaAssets.logo),
    ...Object.values(assets.codexiaAssets.symbol),
    ...Object.values(assets.codexiaAssets.icons),
    ...Object.values(assets.codierPoses),
    ...Object.values(assets.codierExpressions),
  ];
  assert.equal(new Set(registered).size, registered.length);
  for (const asset of registered) assert.equal(fs.existsSync(path.join(publicRoot, asset)), true, asset);
  assert.equal(fs.existsSync(path.join(publicRoot, "brand/codier/reference")), false, "reference sheets must not ship as UI assets");
  assert.equal(Object.keys(assets.codierPoses).length, 28);
});
