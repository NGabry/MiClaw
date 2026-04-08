<p align="center">
  <img src="https://raw.githubusercontent.com/NGabry/MiClaw/main/public/lobster.gif" alt="MiClaw" width="280" />
</p>

### Maintain Your Lobsters

Launch, manage, and monitor all your Claude Code sessions in one place.

One dashboard. Every session. Full terminals. Real-time status.
Plus a unified view of every agent, skill, hook, and config across your entire machine.

<p align="center">
  <a href="https://www.npmjs.com/package/miclaw-app"><img src="https://img.shields.io/npm/v/miclaw-app?style=flat-square&color=d97757&label=version" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/miclaw-app"><img src="https://img.shields.io/npm/dm/miclaw-app?style=flat-square&color=2b2a27&label=downloads" alt="monthly downloads" /></a>
  <a href="https://github.com/NGabry/MiClaw"><img src="https://img.shields.io/github/stars/NGabry/MiClaw?style=flat-square&color=d97757&label=stars" alt="github stars" /></a>
  <img src="https://img.shields.io/badge/platform-macOS-2b2a27?style=flat-square" alt="macOS" />
  <img src="https://img.shields.io/badge/node-20%2B-d97757?style=flat-square" alt="node 20+" />
</p>

---

<!-- replace with a demo GIF/video of sessions: tab switching, launching, adopt flow, status indicators -->
![MiClaw](https://raw.githubusercontent.com/NGabry/MiClaw/main/public/screenshot.png)

## Install

```bash
npx miclaw-app
```

One command. Local server, open port, browser launches. No cloud, no accounts, no API keys.

---

## Sessions

The core of MiClaw. A tabbed terminal dashboard where you launch, monitor, and control every Claude Code instance on your machine.

- **Launch sessions** -- spin up Claude Code in full interactive xterm.js terminals, right in your browser. Pick a working directory, set a model, configure permissions, and go.
- **Monitor everything** -- see every running Claude session at a glance with real-time status indicators. Know instantly which sessions are working, which are waiting for input, and which are idle.
- **Detect and adopt** -- MiClaw automatically discovers Claude Code sessions running in Terminal.app and mirrors their output. One click to **Adopt** any detected session into a fully managed MiClaw terminal.
- **Crash recovery** -- sessions survive page refreshes and auto-resume if the process dies. Your work doesn't disappear.
- **Cost tracking** -- real-time token usage and estimated cost per session.
- **Keyboard-driven** -- `Shift+Esc` enters command mode for fast navigation without touching the mouse.

<!-- replace with a demo GIF of session launch + adopt flow -->

### Keyboard shortcuts

`Shift+Esc` enters command mode (works even inside a focused terminal):

| Key | Action |
|-----|--------|
| `1-9` | Jump to tab |
| `j` / `k` | Next / previous tab |
| `n` | New session |
| `a` | Adopt detected session |
| `X` | Kill active session |
| `O` | Open in Terminal.app |
| `Esc` | Exit command mode |

---

## Config dashboard

MiClaw also scans `~/.claude/` and every project-level config to give you a unified picture of how Claude Code is wired across your machine.

- **Visualize** -- interactive circle-pack and tree views that surface agents, skills, slash commands, MCP servers, hooks, settings, permissions, keybindings, and instruction files across all projects
- **Edit in place** -- modify agents, skills, commands, and instruction files directly in the dashboard. No more hunting through nested directories.

<!-- replace with a screenshot/GIF of the overview visualization -->

---

## Stack

- **Next.js 16** -- App Router, React Server Components, standalone output
- **React 19** -- client components only where needed
- **TypeScript** -- strict mode
- **Tailwind CSS v4** -- `@theme inline` blocks
- **d3-hierarchy** -- layout math only, React renders the DOM
- **xterm.js** + **node-pty** -- embedded terminal emulator with PTY server

## Development

Node.js 20+ and [Bun](https://bun.sh/) required.

```bash
git clone https://github.com/NGabry/MiClaw.git
cd MiClaw
bun install
bun run dev
```

| Command | |
|---|---|
| `bun run dev` | Dev server with hot reload |
| `bun run build` | Production build (standalone) |
| `bun run check` | Lint + typecheck |

## Publishing

```bash
npm publish
```

`prepublishOnly` builds standalone output automatically. The npm package ships pre-built -- end users don't compile anything.

## Requirements

- Node.js 20+
- macOS (full feature set -- embedded terminals, session detection, Terminal.app mirroring)
- Other platforms get config visualization and inline editing

## License

MIT

---

<p align="center">
  <img src="https://raw.githubusercontent.com/NGabry/MiClaw/main/public/logo.png" alt="MiClaw" width="100" />
  <br/>
  <sub>"How am i supposed to maintain all these lobsters."</sub>
  <br/>
  <sub>-- Nick G.</sub>
</p>
