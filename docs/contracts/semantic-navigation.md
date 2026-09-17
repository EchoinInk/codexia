# Semantic Navigation Contract

`IntelligenceContext.navigation` exposes:

- `searchSymbols(query, options?)`: workspace declarations; default fuzzy, case-insensitive, maximum 100 results. Modes: exact, prefix, fuzzy (ordered subsequence). Filters: file, kind, exportedOnly, caseSensitive. An empty query lists matching declarations. Invalid/nonpositive limits yield no results.
- `documentSymbols(file)`: source-order declarations, including optional lexical `container` labels.
- `definitions(file, position)`: compiler-resolved declaration locations.
- `references(file, position)`: compiler reference locations, including declaration occurrences when supplied by TypeScript.
- `implementations(file, position)`: compiler-resolved implementation locations.

Files are workspace-relative. Returned separators are `/`. Lines and columns are one-based; columns count UTF-16 code units. Range ends are exclusive. Legacy symbols without ranges return a zero-width location at column 1. Unknown files, unresolved symbols, invalid positions, and files without indexed source return empty results. Compiler results are deduplicated and ordered by file, line, and column. Multiple candidates are retained; callers must not silently treat the first result as uniquely correct.

Declaration `exported` indicates an explicit export modifier, including exported variable statements. It does not infer re-export reachability or every export-list alias. Symbol search is declaration discovery, not a public-API inventory.

## HTTP adapter

`GET /api/intelligence/navigation` operates on the configured workspace only.

Parameters:

- `operation`: search (default), symbols, definitions, references, implementations.
- `query`: search text; defaults to empty.
- `mode`: exact, prefix, fuzzy (default).
- `file`: optional search filter; required for other operations.
- `line`, `column`: positive integers, required for semantic position queries.

Examples:

- `/api/intelligence/navigation?operation=search&query=createWorkspace&mode=prefix`
- `/api/intelligence/navigation?operation=symbols&file=lib/intelligence/workspace-index.ts`
- `/api/intelligence/navigation?operation=definitions&file=lib/intelligence/workspace-index.ts&line=1&column=1`

Success returns `{ results, background }`. Invalid operations, modes, required arguments, and paths escaping the workspace return HTTP 400. Indexing/query failures return HTTP 500. The adapter does not return source text. `background` is the existing background-index status, not a guarantee of source freshness. HTTP search returns at most 100 results; the in-process API exposes additional filters and limit control.

## Verification handoff

The navigation regression fixtures now pass within the 24-test `npm test` suite. The TypeScript check also passed after Phase 6.4. Lint/build remain pending. Available checks from the repository root:

- `npm run lint`
- `npx tsc --noEmit`
- `npm test`
- `npm run build`

The regression fixtures cover multiple bindings, destructuring, containers, exact/prefix/fuzzy search, aliases, shadowing, implementation lookup, path aliases, invalid positions, incremental replacement/removal/reuse, source persistence, and rejection of old snapshots. The test harness transpiles with the existing TypeScript dependency; it does not typecheck, so the separate typecheck remains necessary.

Also exercise HTTP invalid-argument/path handling and a saved-file change followed by background refresh in a running development instance. External-package resolution and unsaved-buffer navigation are intentionally outside the supported contract.
