const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
// Use the existing TypeScript dependency; no additional test runner is needed.
const root = path.resolve(__dirname, "..");
const modules = new Map();
function load(file) {
  file = path.resolve(file);
  if (!fs.existsSync(file)) file += ".ts";
  if (fs.statSync(file).isDirectory()) file = path.join(file, "index.ts");
  if (modules.has(file)) return modules.get(file).exports;
  const module = { exports: {} };
  modules.set(file, module);
  const compiled = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const localRequire = name => name.startsWith("@/")
    ? load(path.join(root, name.slice(2)))
    : name.startsWith(".") ? load(path.resolve(path.dirname(file), name)) : require(name);
  vm.runInThisContext(`(function(require, module, exports) {${compiled}\n})`, { filename: file })(
    localRequire, module, module.exports
  );
  return module.exports;
}

module.exports = { load, root };
