# IDE Intelligence — Phases 6.1–6.4

## Scope and entry points

The baseline roadmap identifies semantic navigation and symbol search as the first Phase 6 objectives, without numbered acceptance criteria. Phase 6.1 delivers those objectives through a read-only Intelligence API. It includes workspace symbol search, document symbols and containers, definition lookup, reference lookup, implementation lookup, and file/source ranges. Phases 6.2–6.4 extend this API with diagnostics, optional model explanations, validated code actions, refactor/rename planning, reviewed application, and architecture/dead-code reports. See `docs/contracts/ide-changes.md`.

Consumers use `createIntelligenceContext(index).navigation` or `createSemanticNavigation(index)`. The HTTP adapter is `GET /api/intelligence/navigation`. This milestone exposes programmatic navigation; the current file viewer does not yet provide editor gestures or a symbol-search panel.

## Existing index ownership

`CodeSymbol` remains the declaration record. The existing AST walker adds identifier ranges, container names, methods, properties, and all variable bindings, including destructuring. The historical uppercase-variable component convention remains unchanged. Container names describe lexical nesting; they are not globally unique symbol identities. Anonymous declarations, parameters, and import aliases are not enumerated by declaration search, although compiler navigation can resolve uses of those constructs.

`IndexedFile.sourceText` retains TS/TSX/JS/JSX and Markdown source and files named `tsconfig*.json` or `jsconfig*.json`. Index construction reads source once for both analysis and hashing. Full source costs additional index memory and persisted disk space; it is necessary because the existing 500-character preview cannot support semantic lookup. Source is not added to model context fields.

The existing incremental updater replaces changed files, adds new files, removes deleted files, and reuses unchanged file objects. Search and navigation derive from that snapshot. No second scanner, watcher, background queue, persistent symbol database, or dependency graph is introduced.

## Compiler queries

Search traverses existing declaration records and ranks exact, prefix, then subsequence matches with deterministic tie ordering. Semantic lookup uses the existing TypeScript dependency's language service against a virtual, read-only view of indexed source. The service is created only for a semantic query and disposed afterward. This avoids retained compiler state and stale cross-snapshot caches, at the cost of compiler setup on each navigation query. Large-workspace latency remains a performance limitation.

The virtual host does not access the filesystem. Root tsconfig/jsconfig compiler options and available indexed relative config extensions participate in resolution. All indexed TS/JS files are roots; tsconfig include/exclude lists do not override the workspace index's membership. Packages, standard-library declarations, missing configuration extensions, arbitrary-named config files, nested project configurations, project references, and sources outside the index are not fully modeled. Results describe the indexed workspace, not a complete editor language-server project.

The existing dependency graph now uses the shared compiler host to resolve module edges, including re-exports and aliases. Planning and impact analysis consume the resolved workspace paths, including transitive dependents. Raw import specifiers remain in the graph. TypeScript resolves semantic symbol identity, including aliases and lexical shadowing.

## Lifecycle and compatibility

Persisted workspace state now uses schema version 3 (Phase 7 adds Markdown source for documentation obligations). Older/unversioned snapshots are rejected and rebuilt through the existing index manager. This ensures unchanged source files also acquire source text and locations. Legacy in-memory symbol records still provide line-only search locations; semantic queries cannot navigate files lacking source text.

Navigation objects are bound to their supplied index snapshot. Obtain a new context after refresh to observe changes. The HTTP adapter uses the existing manager, which can return cached data while background refresh proceeds. The response includes background status; no freshness guarantee is implied. Unsaved editor buffers are outside this index. No source mutation occurs during lookup.

## Architecture boundaries

Intelligence owns source understanding and read-only lookup. The HTTP route only validates requests and adapts results. Planner, Executor, Workflow, Validator, Reporter, Models, and the Runtime above Workflow retain their existing responsibilities. No model provider is involved in navigation.

## Diagnostics, proposals, and application

The extracted `compiler-project.ts` is shared by navigation, diagnostics, refactoring, and graph resolution. Diagnostic providers report structured evidence. The Models adapter optionally supplies explanations and suggestions; it cannot execute edits. Intelligence creates snapshot-bound proposals using the existing diff contract, and Validator checks paths, original content, proposal integrity, and compiler regressions.

`change-workflow.ts` coordinates fresh validation, the existing Patch Executor, the verification pipeline, and durable conflict-aware rollback. `guarded-files.ts` provides symlink rejection and compare-before-write behavior. HTTP apply/recovery adapters notify the existing index manager after execution. In-process hosts must likewise invalidate or refresh their cached index after applying changes. This is a bounded Workflow extension, not another Runtime.

Architecture analysis extends the existing graph with findings rather than maintaining another graph lifecycle. Reporter owns Markdown formatting. Entry roots and layer rules are explicit inputs; unused/unreachable findings carry limited confidence when external or dynamic use is unknown.
