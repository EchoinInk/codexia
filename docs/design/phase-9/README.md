# Codexia Phase 9 — Design Reference

This directory contains the authoritative visual design references for **Codexia Phase 9 — AI-Native Development Environment**.

These assets define how Phase 9 should look, feel, and behave when implemented.

The approved mockups are implementation targets, not loose inspiration.

Phase 9 must translate these references into a coherent, reusable product system rather than reproduce them as isolated screenshots.

---

# Codexia Phase 9 — Design Reference

This directory contains the authoritative visual design references for **Codexia Phase 9 — AI-Native Development Environment**.

These assets define how Phase 9 should look and feel when implemented.

The approved mockups are implementation targets, not loose inspiration.

---

## 1. Directory Structure

```text
├── brand
│   ├── codier
│   │   ├── expressions
│   │   │   └── codier-winking.png
│   │   ├── poses
│   │   │   ├── codier-analysing-with-binoculars.png
│   │   │   ├── codier-building-stack.png
│   │   │   ├── codier-building.png
│   │   │   ├── codier-celebrating.png
│   │   │   ├── codier-checking-results.png
│   │   │   ├── codier-coding.png
│   │   │   ├── codier-comparing-options.png
│   │   │   ├── codier-debugging.png
│   │   │   ├── codier-deploying.png
│   │   │   ├── codier-documenting.png
│   │   │   ├── codier-explaining.png
│   │   │   ├── codier-greeting.png
│   │   │   ├── codier-inspecting-code.png
│   │   │   ├── codier-meditating.png
│   │   │   ├── codier-monitoring-runtime.png
│   │   │   ├── codier-planning-architecture.png
│   │   │   ├── codier-playing.png
│   │   │   ├── codier-reading-docs.png
│   │   │   ├── codier-resting-after-coding.png
│   │   │   ├── codier-resting.png
│   │   │   ├── codier-reviewing-pull-request.png
│   │   │   ├── codier-searching.png
│   │   │   ├── codier-sitting.png
│   │   │   ├── codier-sleeping.png
│   │   │   ├── codier-troubleshooting.png
│   │   │   ├── codier-typing.png
│   │   │   ├── codier-waving.png
│   │   │   └── codier-working-on-laptop.png
│   │   ├── README.md
│   │   ├── reference
│   │   │   ├── codier-brand-showcase.png
│   │   │   └── codier-character-sheet.png
│   │   └── ui
│   │       ├── assistant
│   │       ├── avatars
│   │       └── indicators
│   └── logo
│       ├── app-icons
│       │   ├── codexia-app-icon-1024.png
│       │   ├── codexia-app-icon-192.png
│       │   ├── codexia-app-icon-512.png
│       │   └── codexia-apple-touch-icon-180.png
│       ├── favicons
│       │   ├── favicon-16.png
│       │   ├── favicon-32.png
│       │   └── favicon-48.png
│       ├── png
│       │   ├── codexia-logo-dark.png
│       │   ├── codexia-logo-light.png
│       │   ├── codexia-logo-primary.png
│       │   ├── codexia-symbol-dark.png
│       │   ├── codexia-symbol-light.png
│       │   ├── codexia-symbol-primary.png
│       │   ├── codexia-wordmark-dark.png
│       │   └── codexia-wordmark-light.png
│       └── svg
│           ├── codexia-logo-dark.svg
│           ├── codexia-logo-light.svg
│           ├── codexia-logo-primary.svg
│           ├── codexia-symbol-dark.svg
│           ├── codexia-symbol-light.svg
│           └── codexia-symbol-primary.svg
├── mockups
│   ├── 01-codexia-nebula-canonical-application-shell.png
│   ├── 02-codexia-nebula-control-centre.png
│   ├── 03-codexia-nebula-mission-workspace.png
│   ├── 04-codexia-nebula-main-ide-build-workspace.png
│   ├── 05-codexia-nebula-focused-pair-programming.png
│   ├── 06-codexia-nebula-agent-canvas.png
│   ├── 07-codexia-nebula-agent-management.png
│   ├── 08-codexia-nebula-execution-workspace.png
│   ├── 09-codexia-nebula-command-deck-states.png
│   └── 10-codexia-nebula-integrations-state-system.png
├── README.md
└── references
    └── original-concepts
```
---

# 2. Source-of-Truth Hierarchy

When visual references conflict, use the following priority:

1. `brand/codier/reference/`
2. `brand/logo/`
3. approved files in `mockups/`
4. this README
5. `references/original-concepts/`

Files inside `references/` are historical or exploratory only.

They must not override approved Phase 9 brand assets or mockups.

If an older Codier asset conflicts with the current character sheet, the current character sheet wins.

If an older logo conflicts with an asset under `brand/logo/`, the approved brand asset wins.

If an original concept conflicts with an approved mockup, the approved mockup wins.

---

# 3. Phase 9 Product Principle

Phase 9 is the product experience layer built on top of the existing Codexia platform.

It should expose and orchestrate existing intelligence rather than recreate it.

The core lifecycle is:

`Mission → Planner → Approval → Workflow → Agents / Executor → Validator → Reporter`

Control Centre, Mission Workspace, Agent Workspace, IDE, Execution Workspace, and other Phase 9 surfaces are different projections of this same lifecycle.

They must not become independent implementations of mission state, execution state, agent state, validation state, or reporting.

---

# 4. Preserve Existing Architecture

The Phase 9 mockups define the desired product experience.

They do not automatically override validated application architecture or existing runtime behaviour.

Phase 8 intelligence, planning, execution, validation, reporting, diagnostics, navigation, symbol search, refactoring, architecture analysis, and runtime systems should remain authoritative unless a demonstrated Phase 9 requirement requires a change.

Before altering architecture:

1. inspect the existing implementation
2. identify the authoritative state owner
3. identify the existing service/repository/runtime boundary
4. reuse the existing capability where appropriate
5. add UI integration at the correct boundary
6. change architecture only when evidence demonstrates it is necessary

Do not recreate working backend intelligence merely to make a screen resemble a mockup.

---

# 5. Codexia Nebula Visual System

Phase 9 uses the **Codexia Nebula** design language.

It should feel:

- intelligent
- technical
- atmospheric
- premium
- expressive
- calm
- futuristic
- highly functional

The cosmic visual language surrounds the work.

It must not interfere with the work.

> **Cosmic around the work. Quiet where the work happens.**

Code editors, terminals, diffs, logs, diagnostics, tables, and other dense technical surfaces should remain especially clean and readable.

---

# 6. Core Colour System

Use the following Phase 9 tokens as the canonical visual palette.

| Token | Value | Purpose |
| --- | --- | --- |
| Nebula Ink | `#050B1B` | Main application background |
| Deep Orbit | `#09142B` | Editor, terminal and sidebar surfaces |
| Orbit | `#0E1C38` | Primary panels |
| Cosmic Slate | `#172A4D` | Elevated and secondary surfaces |
| Stellar Slate | `#526A98` | Borders, inactive UI and muted controls |
| Starlight | `#F5F7FF` | Primary text |
| Moonlight | `#C9D4F3` | Secondary text |
| Codier Periwinkle | `#6F78F4` | Primary brand and interaction colour |
| Nebula Lavender | `#A78BFA` | Secondary interaction colour |
| Aurora Violet | `#7E58FF` | AI and agent states |
| Ion Cyan | `#35D9F2` | Intelligence, analysis and live data |
| Cosmic Blue | `#4285F4` | Execution, code and system activity |
| Codier Magenta | `#FF63D8` | Expressive Codier accent |
| Codier Pink | `#FF8FDB` | Small personality details |
| Success | `#42D6A4` | Successful or verified state |
| Warning | `#F6B95E` | Warning or attention state |
| Danger | `#FF647C` | Error or destructive state |

---

# 7. Signature Gradients

## Codexia Primary

`#6F78F4 → #7E58FF`

Use for primary Codexia identity and selected branded interaction surfaces.

## Intelligence

`#4285F4 → #35D9F2`

Use for intelligence, analysis, system computation, and selected live-state visualisation.

## Codier / Aurora

`#7E58FF → #FF63D8`

Use selectively for Codier and expressive AI states.

Do not cover every component in gradients.

Gradients should provide emphasis, not become the default surface treatment.

---

# 8. Colour Hierarchy

Approximately **75–80%** of the interface should consist of:

- Nebula Ink
- Deep Orbit
- Orbit
- Cosmic Slate

These colours create the working environment.

### Primary product identity

Use:

- Codier Periwinkle
- Aurora Violet
- Nebula Lavender

### Intelligence

Use:

- Ion Cyan
- Cosmic Blue

### Personality

Use:

- Codier Magenta
- Codier Pink

Pink and magenta must remain restrained.

They belong primarily to Codier and expressive AI moments rather than becoming the general interface colour.

The visual rule is:

> **Dark space is the canvas.  
> Blue-violet is Codexia.  
> Cyan communicates intelligence.  
> Pink belongs to Codier.**

---

# 9. Visual Motifs

Approved Codexia Nebula motifs include:

- fine constellation connections
- agent relationship nodes
- orbital curves
- restrained star fields
- subtle nebula texture
- four-point Codier sparkle glyphs
- luminous active-agent edges
- low-intensity intelligence glows
- restrained pearlescent violet highlights
- subtle data pulses
- lightweight orbital motion
- glass treatment on floating surfaces

These motifs should reinforce hierarchy or system meaning.

They must not become decorative noise.

Avoid:

- heavy glow everywhere
- excessive particles
- large distracting star fields behind code
- decorative animated backgrounds in dense work areas
- generic cyberpunk styling
- excessive chrome
- overly saturated neon surfaces

---

# 10. Glass Treatment

Glassmorphism is allowed selectively.

Appropriate surfaces include:

- floating command controls
- assistant overlays
- contextual toolbars
- modal surfaces
- intelligence rails
- selected cards
- active command surfaces
- temporary overlays

Do not make every panel glass.

Primary application surfaces should remain stable, dark, readable, and structurally clear.

---

# 11. Typography

Typography must prioritise readability and information hierarchy.

Use typography consistently for:

- page titles
- workspace titles
- section headings
- panel labels
- navigation
- code-adjacent information
- status labels
- metrics
- supporting text

Avoid introducing arbitrary font weights or sizes per screen.

Repeated typography roles should become reusable tokens.

Code and terminal content must use an appropriate monospaced typeface.

Do not apply decorative typography to code-facing surfaces.

---

# 12. Spacing and Layout

Spacing should follow a consistent reusable scale.

Avoid one-off pixel values where an existing spacing token is suitable.

The product should maintain:

- consistent panel padding
- predictable section gaps
- consistent toolbar heights
- consistent sidebar widths
- aligned grid systems
- predictable card spacing
- clear visual separation between operational and decorative areas

Dense screens may reduce spacing selectively, but the hierarchy must remain clear.

---

# 13. Borders, Radius and Elevation

Use borders and elevation to establish hierarchy without over-segmenting the interface.

Preferred characteristics:

- restrained borders
- low-contrast panel separation
- subtle luminous active edges
- moderate rounded corners
- stronger glow only for meaningful active/intelligence states
- minimal drop shadow inside dense technical surfaces

Do not surround every component with a brightly glowing border.

---

# 14. Codier Canonical Identity

The canonical Codier references are stored in:

`brand/codier/reference/`

These references define Codier's:

- proportions
- facial structure
- eyes
- ears
- fur
- tail
- colouring
- galaxy treatment
- personality
- silhouette
- visual identity

Every Codier asset must preserve the canonical:

- blue-violet galaxy fur
- white muzzle
- white chest
- white paws
- large expressive purple eyes
- pointed fluffy ears
- oversized galaxy tail
- soft rounded proportions
- nebula/star texture
- periwinkle/violet base
- icy-blue highlights
- restrained pink/magenta accents

Pose, props, activity, and expression may change.

Character identity must not.

Do not generate a visually different Codier for each screen.

---

# 15. Codier Pose Selection Rule

Codier poses must be selected according to product context and current system state.

Do not reuse the same Codier pose across all workspaces.

Prefer the most semantically appropriate established asset from:

`brand/codier/poses/`

Examples:

- Mission Planner → `codier-planning-architecture.png`
- Agent Canvas → `codier-analysing-with-binoculars.png`
- Main IDE → `codier-coding.png` or `codier-typing.png`
- Pair Programming → `codier-inspecting-code.png`
- Pull Request / review → `codier-reviewing-pull-request.png`
- Debug state → `codier-debugging.png`
- Runtime monitoring → `codier-monitoring-runtime.png`
- Deployment → `codier-deploying.png`
- Search / discovery → `codier-searching.png`
- Explanation / help → `codier-explaining.png`
- Success → `codier-celebrating.png`
- Idle → `codier-sitting.png`, `codier-resting.png`, or `codier-meditating.png`
- Rest after execution → `codier-resting-after-coding.png`
- Welcome / onboarding → `codier-greeting.png` or `codier-waving.png`
- Active implementation → `codier-building.png` or `codier-building-stack.png`

Use alternate poses where appropriate so Codier feels responsive to the work rather than duplicated across screens.

Do not default to `codier-working-on-laptop.png` simply because the interface involves software development.

The pose must reflect the current activity.

---

# 16. Codier Asset Roles

## `reference/`

Contains canonical character reference material.

Reference files establish character identity.

They are not runtime UI assets.

---

## `poses/`

Contains approved full-character illustrations for specific activities and product states.

These are the primary source for choosing Codier artwork inside Phase 9 interfaces.

---

## `expressions/`

Contains focused facial or emotional expression variants.

Use these where Codier's emotional state matters more than a complete action pose.

---

## `ui/avatars/`

Contains small Codier representations intended for compact UI surfaces such as:

- chat headers
- assistant chips
- command surfaces
- notifications
- status indicators
- compact intelligence panels

---

## `ui/assistant/`

Contains product-ready Codier compositions specifically prepared for assistant surfaces.

Examples may include:

- idle
- thinking
- working
- waiting for user
- success
- warning
- blocked
- error

These should be derived from canonical Codier artwork rather than introducing a new character design.

Do not duplicate every full pose into this directory.

Only create assistant variants that the production UI actually requires.

---

## `ui/indicators/`

Contains very small Codier or intelligence state graphics such as:

- sparkle
- active
- thinking
- complete
- attention
- warning

These should remain visually subordinate to the primary product content.

---

# 17. Codier as Product Intelligence

Codier is not merely decorative.

Codier represents the user-facing layer of Codexia intelligence.

Her visual state should reinforce actual system context.

Examples:

`Planning → codier-planning-architecture.png`

`Implementation → codier-coding.png`

`Inspection → codier-inspecting-code.png`

`Debugging → codier-debugging.png`

`Runtime → codier-monitoring-runtime.png`

`Deployment → codier-deploying.png`

`Review → codier-reviewing-pull-request.png`

`Success → codier-celebrating.png`

Codier may:

- explain system behaviour
- surface recommendations
- communicate agent activity
- help plan work
- explain code
- identify problems
- suggest actions
- communicate verification results
- request user approval
- indicate blocked states
- provide contextual assistance
- celebrate successful work
- act as the primary entry point to AI interaction

Large Codier illustrations should therefore be used intentionally.

For lower-priority contexts, Codier may appear as:

- an avatar
- a compact assistant indicator
- a contextual intelligence rail presence
- a command-deck presence
- a small state graphic

Do not place a large decorative Codier in the bottom-right corner of every screen.

---

# 18. Logo System

Canonical Codexia logo assets are stored under:

`brand/logo/`

The approved Codexia identity must be used consistently.

Do not:

- redesign the mark
- recreate it with arbitrary typography
- substitute previous logo concepts
- stretch or distort it
- alter the symbol geometry
- introduce unrelated colours
- rebuild it differently on individual screens

Use:

- `codexia-logo-primary` for primary branded contexts
- `codexia-logo-light` where required on dark surfaces
- `codexia-logo-dark` on light surfaces
- symbol-only variants where space is constrained

The logo should retain appropriate clear space and legibility.

---

# 19. Approved Phase 9 Mockups

The ten files inside `mockups/` are the approved Phase 9 UI targets.

They represent:

1. Canonical Application Shell
2. Control Centre
3. Mission Workspace
4. Main IDE / Build Workspace
5. Focused Pair Programming
6. Agent Canvas
7. Agent Management
8. Execution Workspace
9. Command Deck States
10. Integrations & State System

These screens belong to one coherent product but must not become copies of one another.

Each workspace must retain its unique functional purpose.

---

# 20. Canonical Application Shell

Reference:

`mockups/01-codexia-nebula-canonical-application-shell.png`

The application shell establishes shared product chrome.

It may include:

- primary navigation
- global search
- workspace/project context
- account/profile controls
- global status
- command access
- shared panel framing

The shell should remain consistent across Phase 9 while allowing each workspace to establish its own internal composition.

Do not force every screen into a dashboard grid.

---

# 21. Control Centre

Reference:

`mockups/02-codexia-nebula-control-centre.png`

The Control Centre is Codexia's system-level overview.

It may expose:

- current focus
- recent missions
- active agents
- live activity
- current workspace
- system status
- metrics
- quick actions
- contextual Codier intelligence

The Control Centre answers:

> **What is happening across Codexia right now?**

It should not become the template for every other workspace.

---

# 22. Mission Workspace

Reference:

`mockups/03-codexia-nebula-mission-workspace.png`

The Mission Workspace makes one active mission the dominant context.

It may expose:

- mission goal
- mission status
- mission timeline
- task/work pods
- mission graph
- active agents
- files
- code context
- execution state
- verification state
- documentation
- mission-level insights

Work areas may expand into deeper:

- Planning
- Execution
- Verification
- Documentation

The Mission Workspace answers:

> **What is happening inside this mission, and what should happen next?**

It must not become another Control Centre.

---

# 23. Main IDE / Build Workspace

Reference:

`mockups/04-codexia-nebula-main-ide-build-workspace.png`

The IDE is the primary coding environment.

Code must remain dominant.

The IDE may contain:

- project/file navigation
- editor
- tabs
- diagnostics
- terminal
- output
- code actions
- AI intelligence rail
- Codier assistant
- mission context
- agent context
- execution controls
- validation feedback

Codier and AI intelligence should remain persistently available without taking over the coding surface.

Decorative cosmic elements must remain especially restrained here.

---

# 24. Focused Pair Programming

Reference:

`mockups/05-codexia-nebula-focused-pair-programming.png`

Focused Pair Programming is a deeper developer + Codier collaboration mode.

It may emphasize:

- active code
- AI reasoning summaries
- proposed changes
- diffs
- explanations
- review controls
- approval
- rejection
- revision
- terminal/test results
- contextual conversation

The user must remain in control of consequential code changes.

AI proposals must remain reviewable.

---

# 25. Agent Canvas

Reference:

`mockups/06-codexia-nebula-agent-canvas.png`

The Agent Canvas visualizes active agent orchestration.

It should emphasize:

- relationships
- responsibilities
- delegation
- communication
- dependencies
- agent activity
- current task queues
- live state
- health
- blockers

Visual relationships should represent meaningful system relationships.

Do not create purely decorative network diagrams.

The Agent Canvas answers:

> **Which agents are working, how are they connected, and what are they doing?**

---

# 26. Agent Management

Reference:

`mockups/07-codexia-nebula-agent-management.png`

Agent Management provides operational management of Codexia's AI workforce.

It may expose:

- available agents
- capabilities
- roles
- permissions
- health
- status
- workload
- assignments
- recent activity
- configuration

Only expose controls that the runtime can actually enforce.

Permission and capability information must remain truthful.

---

# 27. Execution Workspace

Reference:

`mockups/08-codexia-nebula-execution-workspace.png`

The Execution Workspace focuses on active workflow execution.

It may expose:

- workflow steps
- current executor
- delegated agents
- logs
- live events
- artifacts
- blockers
- verification state
- pause/cancel controls
- approvals
- outcomes

The UI must observe and control real execution state.

Do not visually simulate execution that has not occurred.

---

# 28. Command Deck States

Reference:

`mockups/09-codexia-nebula-command-deck-states.png`

The Command Deck is the persistent interaction layer between the user and Codexia intelligence.

It should behave consistently throughout the product.

Possible states include:

- idle
- listening
- thinking
- planning
- working
- waiting for user
- approval required
- blocked
- success
- warning
- error

Codier's visual state should correspond to meaningful command/system states.

The command surface must preserve context between workspaces where appropriate.

---

# 29. Integrations & State System

Reference:

`mockups/10-codexia-nebula-integrations-state-system.png`

This surface defines how external systems and product-level state are represented.

It may expose:

- connected systems
- permissions
- capability state
- connection health
- authentication state
- sync state
- failures
- retry state
- unsupported actions
- degraded state

Do not imply that an integration is active unless it is genuinely configured and operational.

---

# 30. Mockups Are Not Screenshots to Hard-Code

Do not reproduce approved mockups as:

- static screenshots
- huge one-off components
- absolute-positioned imitations
- isolated custom layouts with duplicated styles
- hard-coded fake metrics
- hard-coded fake agent states

Extract reusable systems.

Examples include:

- application shell
- navigation
- design tokens
- typography
- spacing
- buttons
- cards
- tabs
- badges
- status indicators
- agent components
- mission components
- activity components
- Codier surfaces
- command surfaces
- editor chrome
- progress indicators
- toolbars
- data visualisation primitives
- intelligence rails
- error states
- loading states
- empty states

Repeated patterns should become reusable components.

---

# 31. Authoritative State

Phase 9 UI should project authoritative application state.

Avoid introducing separate UI-only copies of:

- mission state
- agent state
- workflow state
- validation state
- execution state
- project state
- integration state
- runtime state

UI-specific transient state is acceptable where appropriate.

Domain state should remain owned by the existing authoritative system.

---

# 32. Interaction Principles

Codexia should feel powerful without feeling chaotic.

Prefer:

- progressive disclosure
- clear primary actions
- visible system status
- traceable AI actions
- explicit approval boundaries
- recoverable actions
- contextual controls
- keyboard-first flows where appropriate
- meaningful defaults

Avoid:

- excessive simultaneous controls
- hidden consequential actions
- ambiguous AI activity
- unexplained automatic changes
- decorative interactions with no system meaning

---

# 33. AI Transparency

Users should be able to understand what Codexia is doing.

Where relevant, communicate:

- what is happening
- why it is happening
- which agent is responsible
- what changed
- what is proposed
- what requires approval
- what failed
- what is blocked
- what was verified
- what evidence supports a result

Avoid presenting inferred or proposed state as completed fact.

---

# 34. Approval Boundaries

Consequential actions should preserve explicit user control where required.

Examples include:

- applying code changes
- accepting generated plans
- deleting files
- destructive refactoring
- changing permissions
- executing risky operations
- deployment
- external integration changes

Approval UI should clearly distinguish:

- proposed
- approved
- running
- completed
- rejected
- failed
- blocked

---

# 35. Accessibility

Phase 9 must remain accessible.

Validate:

- keyboard navigation
- visible focus states
- logical focus order
- semantic controls
- contrast
- readable typography
- text resizing where applicable
- reduced-motion preferences
- non-colour-only state communication
- meaningful labels
- accessible error messages
- accessible status communication

Decorative cosmic effects must never reduce accessibility.

---

# 36. Responsive Behaviour

The Phase 9 mockups primarily demonstrate desktop product direction.

Implementation must still respond intelligently to narrower layouts.

Prioritize:

1. primary task
2. primary working content
3. essential controls
4. system state
5. contextual intelligence
6. decorative content

Secondary panels may collapse, resize, move, or become drawers when necessary.

Do not simply shrink a desktop dashboard until it becomes unreadable.

---

# 37. Keyboard-First Workflows

Technical workspaces should support efficient keyboard use where appropriate.

This is especially important for:

- IDE
- command deck
- search
- file navigation
- command palette
- pair programming
- diagnostics
- agent commands
- mission navigation

Mouse interaction must remain supported.

Keyboard support should enhance rather than replace conventional interaction.

---

# 38. Motion

Motion should communicate system state rather than provide constant decoration.

Appropriate motion includes:

- subtle status transitions
- agent state changes
- active execution feedback
- command deck transitions
- expanding work pods
- lightweight graph transitions
- contextual Codier state changes

Avoid:

- continuous unnecessary movement
- large background animation behind code
- excessive bouncing or pulsing
- animated effects that make status harder to interpret

Respect reduced-motion preferences.

---

# 39. Loading States

Loading states should indicate what is being loaded.

Avoid generic indefinite spinners wherever meaningful progress or context can be shown.

Where appropriate, distinguish:

- initial loading
- refreshing
- agent waiting
- computation
- execution
- synchronization
- validation

Do not use Codier's thinking state as a substitute for truthful product state.

---

# 40. Empty States

Empty states should explain:

- why the area is empty
- whether that state is expected
- what action is available next

Codier may support empty states when appropriate, but should not obscure the actual product action.

---

# 41. Error and Blocked States

Errors should distinguish:

- recoverable error
- validation failure
- blocked dependency
- permission failure
- unavailable integration
- runtime failure
- user intervention required

Where possible provide:

- what happened
- what was affected
- what remains safe
- what the user can do
- whether retry is available

Avoid generic "Something went wrong" messaging when the system knows more.

---

# 42. Success States

Success should communicate completed work clearly without excessive celebration.

Codier's celebration pose may be used for meaningful milestones.

Routine low-level successful operations usually need a lighter confirmation state.

---

# 43. Data and Metrics

All production metrics should come from real application state or clearly identified derived calculations.

Do not ship fake dashboard metrics merely because they appear in a visual mockup.

Mock data may be used during implementation or Storybook-style development only where clearly isolated from production.

---

# 44. Performance

Visual fidelity must not come at the expense of product performance.

Avoid:

- excessive animated backgrounds
- unnecessary canvas rendering
- oversized uncompressed artwork
- rendering large agent graphs when off-screen
- repeated expensive calculations
- unnecessary re-renders
- unbounded activity feeds

Measure actual performance before introducing large optimisation rewrites.

---

# 45. Production Asset Usage

Large design references under `docs/design/phase-9/` are documentation assets.

Do not automatically bundle the entire design-reference directory into the production application.

Only approved runtime assets should be copied or imported into production asset locations.

Examples include:

- approved logo variants
- app icons
- favicons
- selected Codier pose assets
- avatar assets
- assistant states
- status indicators

---

# 46. Reference Material

Everything under:

`references/original-concepts/`

is non-authoritative.

These files may help explain how the final design evolved.

They must not introduce new requirements.

Do not implement an older design merely because it exists in this folder.

Approved mockups and canonical brand references always take precedence.

---

# 47. Implementation Sequence

A sensible Phase 9 implementation sequence is:

1. establish design tokens
2. integrate canonical branding
3. establish Codier asset registry/state model
4. build reusable UI primitives
5. build canonical application shell
6. implement Control Centre
7. implement Mission Workspace
8. implement Mission Planner
9. implement Execution Workspace
10. implement Agent Canvas
11. implement Agent Management
12. implement Main IDE
13. implement Focused Pair Programming
14. implement Command Deck
15. implement Integrations & State System
16. connect all surfaces to authoritative state
17. complete accessibility and keyboard behaviour
18. complete responsive behaviour
19. complete loading/empty/error/blocked states
20. perform cross-product visual consistency review
21. run product-level regression and release qualification

Implementation ordering may change where existing architecture creates a better dependency sequence.

Do not claim a workspace complete merely because its visual shell exists.

---

# 48. Definition of Visual Completion

A Phase 9 screen is not visually complete until:

- it uses canonical design tokens
- the correct logo is used
- Codier uses a canonical asset
- Codier's pose matches context
- typography is consistent
- spacing is consistent
- responsive behaviour exists
- focus states exist
- loading state exists where required
- empty state exists where required
- error state exists where required
- blocked state exists where required
- live data is distinguishable from mock data
- repeated patterns use shared components
- decorative effects do not reduce usability
- the screen matches the approved design intent

---

# 49. Definition of Product Completion

A workspace is not complete simply because it visually matches a mockup.

Completion requires:

- working navigation
- authoritative state integration
- real supported actions
- error handling
- accessibility
- responsive behaviour
- keyboard behaviour where applicable
- integration with the shared lifecycle
- validation of critical user flows
- no known blocking regressions
- no required production behaviour dependent on fake data

---

# 50. Visual Fidelity

Implementation should achieve strong visual fidelity to the approved mockups without sacrificing:

- accessibility
- responsiveness
- maintainability
- performance
- semantic structure
- product correctness
- existing validated architecture

Where literal screenshot reproduction conflicts with usability or technical correctness, preserve the **design intent** rather than hard-coding the visual artefact.

---

# 51. Conflict Resolution

When implementation decisions conflict, use the following order:

### Character appearance

`brand/codier/reference/`

### Brand identity

`brand/logo/`

### Approved layout and visual intent

`mockups/`

### Shared design rules

this README

### Historical inspiration

`references/original-concepts/`

### Functional behaviour

existing validated Codexia architecture and authoritative runtime contracts

A screenshot may define how something should appear.

It does not automatically define a new backend architecture.

---

# 52. Phase 9 Product Standard

Phase 9 should feel like **one coherent Codexia product**, not a collection of unrelated futuristic dashboards.

Across every screen, preserve:

- Codexia identity
- Codexia Nebula visual language
- canonical Codier
- shared interaction patterns
- consistent design tokens
- consistent application shell
- consistent component behaviour
- authoritative system state
- clear AI transparency
- strong technical usability

At the same time, preserve the unique functional purpose of each workspace.

**Codier should feel alive.**

**Codexia should feel intelligent.**

**The interface should remain focused on the work.**
