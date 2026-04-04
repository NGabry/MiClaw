<p align="center">
  <img src="https://raw.githubusercontent.com/NGabry/MiClaw/main/public/logo.png" alt="MiClaw Logo" width="200" />
</p>

## Overview

MiClaw helps you maintain your lobsters. It scans your `~/.claude/` directory and project-level configuration files to present a unified view of how Claude Code is set up on your machine. It surfaces agents, skills, slash commands, MCP servers, hooks, settings, permissions, keybindings, and instruction files to help you visulaize inheritance and nesting patterns among your different claude powered projects.

It also allows editing of skills, slash commands, and rules directly in the app for easy centralized maintenance of all your claude files.

MiClaw includes live session monitoring -- it scans running Claude Code processes, displays their status, conversation history, and git branch, and lets you type messages directly into a session's terminal from the dashboard. The Sessions page uses vim-style keybindings and editor for composing messages. 

**Optimized for macOS.** Session messaging uses a native Swift helper to type directly into Terminal.app without stealing focus. The core visualization and editing features work on any platform, but the full experience is designed for macOS.

## Quick Start

Requires macOS and Node.js v20+.

```bash
npx miclaw-app
```

MiClaw will start a local server, find an open port, and open your browser. Press Ctrl+C to stop.

Requires Node.js v20+.


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
- **CodeMirror 6** + **@replit/codemirror-vim** -- vim-enabled session editor
- **react-markdown** + **remark-gfm** -- Markdown rendering for session messages
- **lucide-react** -- icons
