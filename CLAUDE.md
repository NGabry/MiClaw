@AGENTS.md

# MiClaw

A visualization and editing dashboard for Claude Code configuration. Scans `~/.claude/`, `~/.claude.json`, and project directories to display agents, skills, commands, MCP servers, hooks, settings, permissions, keybindings, and instruction files. Supports inline editing of agents, skills, commands, and instruction files via Server Actions.

## Tech Stack

- **Next.js 16** (App Router, Server Components, standalone output) with **Bun** as package manager
- **Tailwind CSS v4** (uses `@theme inline` blocks, NOT tailwind.config.ts)
- **TypeScript** (strict mode)
- **d3-hierarchy** for circle-pack and tree layout math (React renders the DOM, NOT D3)
- **react-markdown** + **remark-gfm** for rendering assistant messages as Markdown
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

### Sessions feature (tiling terminal dashboard)
- `src/lib/sessionScanner.ts` -- Scans `~/.claude/sessions/` PID files and reads JSONL logs from `~/.claude/projects/` to extract session metadata (title, git branch, turnState). Uses mtime-based caching. Computes `turnState: "idle" | "working" | "needs_input"` from the JSONL conversation state.
- `src/lib/miclawSessions.ts` -- Manages MiClaw-owned sessions stored in `~/.claude/miclaw-sessions.json`.
- `src/lib/paneTypes.ts` -- Type definitions for the tiling pane tree: `LeafPane`, `SplitPane`, `PaneNode`, `PaneLayout`.
- `src/lib/paneUtils.ts` -- Pure functions for pane tree operations: `splitLeaf`, `removeLeaf`, `moveTab`, `updateRatio`, `reconcileTabs`, `saveLayout`/`loadLayout` (localStorage persistence).
- `src/lib/paneContext.ts` -- React context providing pane layout state and mutation callbacks to all pane components.
- `src/components/SessionsView.tsx` -- Orchestrator: data fetching, pane layout state, command mode, keyboard navigation. Provides `PaneCtx` and renders `PaneTree`.
- `src/components/PaneTree.tsx` -- Recursive renderer: splits render as flex containers with `PaneDivider` between children; leaves render as `PaneLeaf`.
- `src/components/PaneLeaf.tsx` -- Single pane: own tab bar, content area, split/close buttons, edge drop zones for drag-to-split. Contains `TabButton`, `StatusDot`, `MiclawSessionContent`, `DetectedSessionContent`, `NewSessionForm`, and `EdgeDropZone` sub-components.
- `src/components/PaneDivider.tsx` -- Draggable resize handle between split panes. Direct DOM style manipulation during drag for 60fps, commits ratio to React state on mouseup.
- `src/components/MiclawTerminal.tsx` -- xterm.js terminal connected to Node.js PTY server via WebSocket (port 3001). Terminal instances cached globally and survive pane splits/tab moves. Wrapped in `StableTerminal` memo to prevent re-renders from polling.
- `src/components/TerminalMirror.tsx` -- Read-only terminal screen mirror for detected sessions.
- `src/app/api/sessions/route.ts` -- GET returns detected sessions; DELETE kills a session by PID.
- `src/app/api/sessions/colors/route.ts` -- Reads Terminal.app color profile for terminal theming.
- `src/app/api/sessions/focus/route.ts` -- Brings a detected session's Terminal.app window to front.
- `src/app/api/sessions/screen/route.ts` -- Reads Terminal.app tab history for TerminalMirror.
- `src/app/api/sessions/upload/route.ts` -- Saves dropped images to temp files for terminal input.
- `src/app/api/sessions/resolve/route.ts` -- Resolves dropped filenames to full paths via macOS Spotlight (mdfind).
- `src/app/api/tmux/sessions/route.ts` -- GET/POST/DELETE for MiClaw sessions. Queries PTY server for alive/activity/cost. Auto-discovers Claude session IDs for cost tracking.
- `src/app/api/tmux/pty-server/route.ts` -- Ensures the Node.js PTY server is running.
- `helpers/pty-server.mjs` -- Node.js + node-pty WebSocket PTY server (port 3001). Manages real PTY processes, survives Next.js restarts. Auto-discovers Claude session IDs from PID files.

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

### Sessions key patterns
- Tiling pane layout: recursive binary tree of `LeafPane` (tab bar + content) and `SplitPane` (divider between children). Layout persists to `localStorage` key `miclaw:pane-layout`.
- MiClaw terminal instances are cached globally in a `Map<sessionId, CachedTerminal>` and survive pane splits, tab moves, and unmount/remount (reattaches the DOM element).
- Terminal wrapped in memoized `StableTerminal` component to prevent re-renders from polling-driven status updates stealing focus.
- `Shift+Esc` enters command mode. `h/l` cycle tabs, `j/k` cycle panes, `Enter` focuses the selected terminal. All commands require explicit command mode to prevent accidental execution when terminal loses focus.
- `Alt+1-9` jumps to tabs without entering command mode.
- Detected sessions poll at 7s with JSONL mtime caching. MiClaw sessions poll at 3s via PTY server WebSocket.
- Turn state detection: `turnState: "idle" | "working" | "needs_input"` computed by finding the last assistant message in JSONL and checking for unmatched `tool_use` blocks. Non-tool-result user messages (task notifications) are skipped.
- Adopt flow: creates a MiClaw session with `resumeId` pointing to the detected session's `sessionId`, kills the original detected process.
- `miclaw:command-mode` custom DOM event bridges xterm key interception to SessionsView state.
- PTY server uses node-pty (not raw forkpty) for proper flow control. Broadcasts are fire-and-forget to prevent backpressure deadlocks.

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

## Development Principles

- **Verify before implementing**: Before building features that depend on external data (JSONL fields, API responses, file formats), verify the data actually exists in the live environment. Use `curl` or scripts to hit the API and inspect real output. Don't assume field names or structures from source code alone -- the runtime format may differ.
- **MiClaw sessions are the priority**: New features should target MiClaw-managed sessions (interactive xterm terminals). Detected sessions are read-only mirrors meant to encourage adoption -- do not add interactivity or new features to them.
- **Cost tracking**: Session cost is estimated from `message.usage` token fields in JSONL assistant entries (input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens). The JSONL does NOT contain explicit cost fields in normal CLI mode -- cost must be computed from tokens.
- **JSONL field names**: The Claude Code JSONL uses the Anthropic API response format. Assistant entries have `message.usage` with snake_case fields, `message.model`, `message.content` blocks. Non-message entries include types like `system`, `progress`, `file-history-snapshot`, `custom-title`, `ai-title`.

## Git Rules

Do NOT run `git add` or `git commit`. The user handles all git operations.
