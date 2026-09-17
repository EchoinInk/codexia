# Decision: index-backed semantic navigation

Status: Implemented; user verification pending.

The September Phase 6 baseline names semantic navigation and symbol search but does not subdivide Phase 6 numerically. Phase 6.1 is defined here as those first two roadmap objectives. The earlier conversation's proposed subdivision is not treated as canonical repository documentation.

Extend existing AST declarations and indexed files, and expose read-only queries through Intelligence. Use TypeScript's existing compiler dependency for semantic identity rather than approximating identity from equal names or dependency suffix matches. A transient language-service view of the existing source snapshot is a query adapter, not another indexing lifecycle.

Alternatives considered: name-only lookup would conflate shadowed symbols; a second language-server scanner would duplicate watcher/cache ownership; retaining a global compiler service would require additional disposal and refresh coordination. The selected design favors correctness within the indexed source boundary and straightforward lifecycle ownership, with additional snapshot storage and per-query compiler setup as explicit costs.

Phase 6.1 includes programmatic APIs and a read-only HTTP adapter. Editor interaction design is not inferred from the baseline roadmap. Those capabilities were outside Phase 6.1. Subsequent authorized Phases 6.2–6.4 are documented in `phase-6-2-6-4-intelligence.md`.
