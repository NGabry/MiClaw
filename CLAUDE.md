@AGENTS.md

# MiClaw

A read-only visualization dashboard for Claude Code configuration. Scans `~/.claude/`, `~/.claude.json`, and project directories to display agents, skills, commands, MCP servers, hooks, settings, permissions, keybindings, and instruction files.

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

### Visualization (client components)
- `src/components/OverviewClient.tsx` -- Orchestrator: manages view toggle (spheres/tree), shared selection state, and the DetailDrawer.
- `src/components/SphereView.tsx` -- Circle-pack visualization using d3-hierarchy pack layout.
- `src/components/TreeView.tsx` -- Rooted tree visualization using d3-hierarchy tree layout.
- `src/components/DetailDrawer.tsx` -- Shared right-side drawer showing selected node's items + inherited items from ancestors.
- `src/components/ViewToggle.tsx` -- Spheres/Tree toggle button.

### Pages
- `src/app/page.tsx` -- Overview page with sphere/tree visualization.
- `src/app/*/page.tsx` -- Detail pages for agents, skills, commands, MCP, hooks, settings, rules.
- `src/components/PageWrapper.tsx` -- Shared page layout wrapper for non-overview pages.

### Key patterns
- Both views are always mounted (no unmount/remount on toggle). Visibility toggled via CSS opacity.
- Selection state (`selectedId`) is lifted to `OverviewClient` and shared between both views.
- The `DetailDrawer` is rendered once by `OverviewClient`, not duplicated per view.
- Views start centered; the drawer pushes content left via `marginRight` transition.
- All scope pages use `ScopeHeader` for consistent scope badge + path display.

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

- This app reads the LOCAL filesystem. No database, no auth, no API keys.
- The scanner must handle missing directories gracefully (repos may have been deleted).
- Project path encoding is lossy (`/`, `_`, `-`, `.`, ` ` all become `-`). The decoder uses greedy matching with a brute-force fallback for hyphenated directory names.
- Never hardcode machine-specific paths. Use `os.homedir()` and dynamic discovery.
- D3 is used ONLY for layout math (`d3-hierarchy` pack/tree). All rendering is React/CSS.
- MCP servers come from both `~/.claude.json` (global) and per-project `.mcp.json` files.

## Git Rules

Do NOT run `git add` or `git commit`. The user handles all git operations.
