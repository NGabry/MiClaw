@AGENTS.md

# MiClaw

A visualization and editing dashboard for Claude Code configuration. Scans `~/.claude/`, `~/.claude.json`, and project directories to display agents, skills, commands, MCP servers, hooks, settings, permissions, keybindings, and instruction files. Supports inline editing of agents, skills, commands, and instruction files via Server Actions.

## Tech Stack

- **Next.js 16** (App Router, Server Components, standalone output) with **Bun** as package manager
- **Tailwind CSS v4** (uses `@theme inline` blocks, NOT tailwind.config.ts)
- **TypeScript** (strict mode)
- **d3-hierarchy** for circle-pack and tree layout math (React renders the DOM, NOT D3)
- **lucide-react** for icons

## Architecture

### Data layer (server-only)
- `src/lib/scanner.ts` -- Filesystem scanner. Reads all Claude config files.
- `src/lib/types.ts` -- All TypeScript types for config data.
- `src/lib/parser.ts` -- YAML frontmatter parser (gray-matter wrapper).
- `src/lib/sphereData.ts` -- Transforms scanned config into hierarchical visualization data with parent-child nesting.
- `src/lib/constants.ts` -- Paths to Claude config directories + `shortenHomePath` helper.
- `src/lib/actions.ts` -- Server Actions for write operations: `saveAgent`, `saveSkill`, `saveCommand`, `saveInstructionFile`, `deleteItem`. All writes are path-validated to stay within `~/.claude/`.

### Visualization (client components)
- `src/components/OverviewClient.tsx` -- Orchestrator: manages view toggle (spheres/tree), shared selection state, and the DetailDrawer. Both views shift left when the drawer opens.
- `src/components/SphereView.tsx` -- Circle-pack visualization using `d3-hierarchy` `pack()` layout.
- `src/components/TreeView.tsx` -- Rooted tree visualization using `d3-hierarchy` `tree()` layout. Pulsing ancestor path highlights the lineage of selected nodes.
- `src/components/DetailDrawer.tsx` -- Right-side drawer with a config-file aesthetic (monospace font, `# section` headers, `[bracketed]` labels).
- `src/components/ViewToggle.tsx` -- Spheres/Tree toggle button.

### Inline editing (client components)
- `src/components/AgentCard.tsx` -- "use client" card with inline edit state; calls `saveAgent` and `deleteItem`.
- `src/components/SkillCard.tsx` -- "use client" card with inline edit state; calls `saveSkill`.
- `src/components/CommandCard.tsx` -- "use client" card with inline edit state; calls `saveCommand`.
- `src/components/RuleCard.tsx` -- "use client" card with inline edit state; calls `saveInstructionFile`.
- `src/components/EditPencil.tsx` -- Shared hover-to-edit pencil icon with pulse animation.

### Scope group wrappers (client)
- `src/components/AgentScopeGroup.tsx` -- Bridges server pages to `AgentCard` client components.
- `src/components/SkillScopeGroup.tsx` -- Bridges server pages to `SkillCard` client components.
- `src/components/CommandScopeGroup.tsx` -- Bridges server pages to `CommandCard` client components.

### Shared UI components
- `src/components/Card.tsx` -- Base card shell.
- `src/components/Badge.tsx` -- Scope/type badge.
- `src/components/ExpandableBody.tsx` -- Collapsible body section for card content.
- `src/components/PermissionList.tsx` -- Collapsible permission lists.
- `src/components/ScopeHeader.tsx` -- Scope badge + path display for detail pages.
- `src/components/PageWrapper.tsx` -- Shared page layout wrapper for non-overview pages.
- `src/components/PageHeader.tsx` -- Page title/header component.
- `src/components/Sidebar.tsx` -- Navigation sidebar.

### Specialized display components
- `src/components/HooksDisplay.tsx` -- Hooks configuration display.
- `src/components/KeybindingsDisplay.tsx` -- Keybindings display.
- `src/components/McpServerCard.tsx` -- MCP server card.
- `src/components/OutputStyleCard.tsx` -- Output style configuration card.
- `src/components/SettingsPriorityChain.tsx` -- Settings priority chain visualization.

### Sessions feature (live session monitoring)
- `src/lib/sessionScanner.ts` -- Scans `~/.claude/sessions/` PID files and reads JSONL logs from `~/.claude/projects/` to extract session metadata (title, git branch, recent messages, status).
- `src/components/SessionsView.tsx` -- Client component: polls `/api/sessions` every 5s, displays live/stale sessions with expandable conversation history and an inline prompt input.
- `src/app/sessions/page.tsx` -- Sessions page (renders `SessionsView`).
- `src/app/api/sessions/route.ts` -- GET returns all sessions; DELETE kills a session by PID.
- `src/app/api/sessions/type/route.ts` -- POST types a message into a session's terminal via a compiled Swift helper (`helpers/type-to-terminal`). Uses `osascript` to select the correct Terminal tab, then the Swift helper sends keystrokes without stealing focus.
- `src/app/api/sessions/focus/route.ts` -- POST focuses a session's Terminal tab via AppleScript (finds the tab by TTY path).
- `helpers/type-to-terminal.swift` -- Swift helper that types text into Terminal.app via the macOS Accessibility API. Must be compiled with `swiftc -O type-to-terminal.swift -o type-to-terminal`.

### Pages
- `src/app/page.tsx` -- Overview page with sphere/tree visualization.
- `src/app/agents/page.tsx` -- Agents detail page.
- `src/app/skills/page.tsx` -- Skills detail page.
- `src/app/commands/page.tsx` -- Commands detail page.
- `src/app/mcp/page.tsx` -- MCP servers detail page.
- `src/app/hooks/page.tsx` -- Hooks detail page.
- `src/app/settings/page.tsx` -- Settings detail page.
- `src/app/rules/page.tsx` -- Rules / instruction files detail page.
- `src/app/sessions/page.tsx` -- Live session monitoring page.
- `src/app/projects/[slug]/page.tsx` -- Per-project detail page.

### Key patterns
- Both views are always mounted (no unmount/remount on toggle). Visibility toggled via CSS opacity.
- Selection state (`selectedId`) is lifted to `OverviewClient` and shared between both views.
- The `DetailDrawer` is rendered once by `OverviewClient`, not duplicated per view.
- Views start centered; the drawer pushes content left via `marginRight` transition.
- All scope pages use `ScopeHeader` for consistent scope badge + path display.
- Write mode uses Next.js Server Actions (`src/lib/actions.ts`). Cards toggle between display and edit mode with local state.
- Monospace/config-file design language: the DetailDrawer and cards use monospace fonts, `# section` headers, and `[bracketed]` labels to echo the feel of editing a config file.

## Design System

Matches the Anthropic/Claude UI aesthetic:

- Background: `#2b2a27` (warm charcoal), raised: `#353430`
- Text: `#faf9f5` (cream), muted: `#b0aea5`, dim: `#7a776e`
- Accent: `#d97757` (terracotta orange) -- used sparingly
- Borders: `rgba(255,255,255,0.06)` -- extremely subtle
- Font: Inter (sans), Geist Mono (mono), Fira Code (logo)
- Grid background on main content area

## Commands

```bash
bun run dev        # Start dev server
bun run build      # Production build (standalone)
bun run start      # Start production server
bun run check      # Lint + typecheck
bun run lint       # ESLint only
bun run lint:fix   # ESLint auto-fix
bun run typecheck  # TypeScript only
```

## Distribution

Published to npm as `miclaw-app`. End users run:
```bash
npx miclaw-app
```
The `prepublishOnly` script builds standalone output. The CLI (`bin/miclaw.mjs`) starts the server on a random port and opens the browser.

## Important Notes

- This app reads and writes the LOCAL filesystem (writes are limited to `~/.claude/` paths). No database, no auth, no API keys.
- The scanner must handle missing directories gracefully (repos may have been deleted).
- Project path encoding is lossy (`/`, `_`, `-`, `.`, ` ` all become `-`). The decoder uses greedy matching with a brute-force fallback for hyphenated directory names.
- Never hardcode machine-specific paths. Use `os.homedir()` and dynamic discovery.
- D3 is used ONLY for layout math (`d3-hierarchy` pack/tree). All rendering is React/CSS.
- MCP servers come from both `~/.claude.json` (global) and per-project `.mcp.json` files.

## Git Rules

Do NOT run `git add` or `git commit`. The user handles all git operations.
