<p align="center">
  <img src="https://raw.githubusercontent.com/NGabry/MiClaw/main/public/logo.png" alt="MiClaw Logo" width="200" />
</p>

## Overview

MiClaw helps you maintain your lobsters. It scans your `~/.claude/` directory and project-level configuration files to present a unified view of how Claude Code is set up on your machine. It surfaces agents, skills, slash commands, MCP servers, hooks, settings, permissions, keybindings, and instruction files to help you visulaize inheritance and nesting patterns among your different claude powered projects.

It also allows editing of skills, slash commands, and rules directly in the app for easy centralized maintenance of all your claude files.

MiClaw includes a session management dashboard with tabbed terminal views:

- **MiClaw sessions** run Claude Code in embedded interactive terminals (xterm.js) powered by a local PTY server. These survive page refreshes, support full two-way interaction, and can resume crashed sessions automatically.
- **Detected sessions** are Claude Code instances running in Terminal.app. MiClaw shows a read-only terminal mirror of their output. You can **Adopt** a detected session to convert it into a fully managed MiClaw session.

### Session status indicators

- **Green** -- session is alive and idle
- **Yellow (pulsing)** -- session needs your input (tool approval, yes/no prompt)
- **Orange (pulsing)** -- session is actively working (producing output)
- **Gray** -- session has ended or the process died

### Keyboard navigation

Press **Shift+Space** to enter command mode (works even when a terminal has focus):

| Key | Action |
|-----|--------|
| `1-9` | Jump to tab by position |
| `j/k` | Cycle to next/previous tab |
| `n` | Create a new MiClaw session |
| `a` | Adopt a detected session |
| `X` | Kill the active session |
| `O` | Open detected session in Terminal.app |
| `Esc` | Exit command mode |

When no terminal is focused, these keys work directly without command mode.

**Primarily developed on macOS.** The embedded terminal sessions feature requires macOS (uses a local PTY server). The core visualization and editing features work on any platform.

## Quick Start

Requires Node.js v20+.

```bash
npx miclaw-app
```

MiClaw will start a local server, find an open port, and open your browser. Press Ctrl+C to stop.


## Development

### Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [Bun](https://bun.sh/) (recommended for package management)

### Setup

```bash
git clone https://github.com/NGabry/MiClaw.git
cd MiClaw
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Commands

```bash
bun run dev        # Start dev server with hot reload
bun run build      # Production build (standalone)
bun run start      # Start production server
bun run check      # Lint + typecheck
bun run lint       # ESLint only
bun run lint:fix   # ESLint auto-fix
bun run typecheck  # TypeScript only
```

### Publishing

```bash
npm login
npm publish
```

The `prepublishOnly` script automatically builds the standalone server before publishing. The npm package ships pre-built so end users don't need to compile anything.

## Tech Stack

- **Next.js 16** -- App Router, React Server Components, standalone output
- **React 19** -- client components only where interactivity is needed
- **TypeScript** -- strict mode
- **Tailwind CSS v4** -- utility-first styling
- **d3-hierarchy** -- circle-pack and tree layout math (React handles all DOM rendering)
- **gray-matter** -- YAML frontmatter parsing
- **react-markdown** + **remark-gfm** -- Markdown rendering for session messages
- **lucide-react** -- icons
