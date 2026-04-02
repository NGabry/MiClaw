@AGENTS.md

# MiClaw

A read-only visualization dashboard for Claude Code configuration. Scans `~/.claude/` and project directories to display agents, skills, commands, MCP servers, hooks, settings, permissions, keybindings, and instruction files.

## Tech Stack

- **Next.js 16** (App Router, Server Components) with **Bun** as package manager
- **Tailwind CSS v4** (uses `@theme inline` blocks, NOT tailwind.config.ts)
- **TypeScript** (strict mode)
- **d3-hierarchy** for circle-pack layout math (React renders the DOM, NOT D3)
- **lucide-react** for icons

## Architecture

- `src/lib/scanner.ts` -- Filesystem scanner (server-only). Reads all Claude config files.
- `src/lib/types.ts` -- All TypeScript types for config data.
- `src/lib/parser.ts` -- YAML frontmatter parser (gray-matter wrapper).
- `src/lib/sphereData.ts` -- Transforms scanned config into hierarchical sphere visualization data.
- `src/lib/buildTree.ts` -- Transforms scanned config into file tree data.
- `src/lib/constants.ts` -- Paths to Claude config directories.
- `src/components/SphereView.tsx` -- Main interactive circle-pack visualization (client component).
- `src/components/Sidebar.tsx` -- Collapsible navigation sidebar (client component).
- `src/app/page.tsx` -- Overview page with sphere visualization.
- `src/app/*/page.tsx` -- Detail pages for agents, skills, commands, MCP, hooks, settings, rules.

## Design System

Matches the Anthropic/Claude UI aesthetic:

- Background: `#2b2a27` (warm charcoal), raised: `#353430`
- Text: `#faf9f5` (cream), muted: `#b0aea5`, dim: `#7a776e`
- Accent: `#d97757` (terracotta orange) -- used sparingly
- Borders: `rgba(255,255,255,0.06)` -- extremely subtle
- Font: Inter (sans), Geist Mono (mono)
- No gradients, no drop shadows (except subtle glows on accent elements), minimal border-radius
- Grid background on main content area

## Key Patterns

- **Server Components** for all pages -- scanner runs at build/request time, no client-side fetching
- **Client Components** only for interactive elements (SphereView, Sidebar, ExpandableBody)
- **PageWrapper** component wraps all non-overview pages with `max-w-5xl px-8 py-10`
- Overview page uses full viewport height with no scroll (`h-full overflow-hidden`)
- Project path decoding handles lossy encoding (all non-alphanumeric chars become `-`)

## Commands

```bash
bun run dev        # Start dev server
bun run build      # Production build
bun run check      # Lint + typecheck
bun run lint       # ESLint only
bun run lint:fix   # ESLint auto-fix
bun run typecheck  # TypeScript only
```

## Important Notes

- This app reads the LOCAL filesystem. No database, no auth, no API keys.
- The scanner must handle missing directories gracefully (repos may have been deleted).
- Project path encoding is lossy (`/`, `_`, `-`, `.`, ` ` all become `-`). The decoder tries multiple separator candidates against the filesystem.
- Never hardcode machine-specific paths. Use `os.homedir()` and dynamic discovery.
- D3 is used ONLY for layout math (`d3-hierarchy` pack). All rendering is React/CSS.
- The sphere visualization uses a slide-in drawer for detail views -- clicking a circle opens a panel, not a new page.

## Git Rules

Do NOT run `git add` or `git commit`. The user handles all git operations.
