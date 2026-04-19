# MiClaw Design System

This document describes the visual and interaction language of MiClaw. It is the source of truth for colors, typography, spacing, motion, and component patterns. Tokens live in `src/app/globals.css` under the Tailwind v4 `@theme inline` block — update there, document here.

---

## Core Identity

MiClaw has one visual identity, and it is not up for debate:

> **Claude terracotta on warm black, Gruvbox-adjacent palette, 24px gridded background.**

Every design decision in this document exists to serve that identity. If a proposed change weakens any of the four pillars below, it doesn't belong in MiClaw.

### The four pillars

1. **Claude terracotta (`#d97757`) as the sole accent.** Borrowed directly from the Claude/Anthropic brand. It is the *only* chromatic color in the app — everything else is a warm neutral. This is what makes MiClaw legibly part of the Claude family at a glance.
2. **Warm black (`#2b2a27`) surfaces.** Not true black, not cool grey. The surface is a warm charcoal that feels lit rather than absent. This warmth is what keeps the app from feeling like a generic dark-mode IDE shell.
3. **Gruvbox-adjacent palette.** Low-saturation, warm, muted — the same family as the Gruvbox theme developers have been living in for a decade. Cream text (`#faf9f5`), earthy muted (`#b0aea5`), dim (`#7a776e`). No pure whites, no cool greys, no vibrant blues or greens in chrome. When we need semantic color (green for idle, cyan for working, yellow for attention), we tolerate brighter hues *only* in small status-dot-sized doses.
4. **24px gridded background.** The grid is not decoration — it is part of the identity. It runs under the main content area, overlays the xterm terminals at reduced opacity, and establishes the visual rhythm of the entire app. Removing the grid would be as breaking as removing the accent color.

### What this rules out, permanently

- **No light mode.** The app is dark-on-warm-charcoal. A light theme would break the identity.
- **No alternate accent colors.** No "blue variant," no user-configurable theme hues. The accent is Claude terracotta and only Claude terracotta.
- **No cool-toned neutrals.** Never `slate-*`, `zinc-*`, or `gray-*` as a surface. Always warm.
- **No gradient surfaces or glass/blur effects.** Flat warm blacks with borders. The only gradient in the app is the 24px grid pattern itself.
- **No removing the grid.** Even in panels, even in modals, even in future views. The grid stays.

---

## Philosophy

Within the identity above, the visual language is shaped by three supporting principles:

1. **Config-file aesthetic.** Monospace type, `# section` headers, and `[bracketed]` labels echo the files MiClaw is reading and writing. The UI should feel continuous with the filesystem it reflects, not layered over it.
2. **Restraint over ornament.** Borders are near-invisible. The single accent color is load-bearing — it means "this is interactive" or "this is selected", and nothing else. When in doubt, remove something.
3. **Motion only where it carries meaning.** Status dots pulse when there is live state. The edit pencil pulses to signal "this is clickable." The drawer slides to establish spatial continuity. Nothing animates for its own sake.

---

## Color System

All color tokens are defined in `src/app/globals.css` and exposed as Tailwind utilities (`bg-surface`, `text-text-muted`, `border-border`, etc.). Never hardcode hex values in components — reference the token.

The palette is deliberately Gruvbox-adjacent: warm, low-saturation, retro-terminal. If a proposed color feels too bright, too cool, or too modern-SaaS, it does not belong here.

### Surfaces

| Token | Hex | Usage |
|---|---|---|
| `--color-surface` | `#2b2a27` | Page background. The warm charcoal base. |
| `--color-surface-raised` | `#353430` | Secondary surfaces: active nav items, badge backgrounds, elevated panels. |
| `--color-surface-hover` | `#3d3c37` | Interactive hover state for buttons, rows, nav items. |

**Rule:** Never introduce a fourth surface shade. If you need more hierarchy, reach for borders or spacing, not new greys.

### Text

| Token | Hex | Usage |
|---|---|---|
| `--color-text` | `#faf9f5` | Primary content. Headings, body, editable values. |
| `--color-text-muted` | `#b0aea5` | Secondary content. Descriptions, non-focused tab labels, badge text. |
| `--color-text-dim` | `#7a776e` | Tertiary content. Paths, timestamps, type labels (`agent`, `cmd`), dead session markers. |

**Rule:** Text hierarchy is three levels, not more. If a piece of text feels like it should be "a bit more faded than muted but brighter than dim", choose one of the two neighbors — don't invent a fourth.

### Accent

| Token | Hex | Usage |
|---|---|---|
| `--color-accent` | `#d97757` | Terracotta orange. **Interaction + selection only.** |
| `--color-accent-dim` | `#b8634a` | Accent for pressed/variant states. Rarely used; prefer opacity modifiers (`accent/60`, `accent/15`). |

**The accent is the most abused token in design systems.** In MiClaw, it carries exactly three meanings:

1. **Selected / active** — the current nav item, the active tab's underline (`border-b-2 border-accent`), the selected node in the sphere/tree view.
2. **Editable / affordance** — the edit pencil (`text-accent/60` at rest, pulses on hover), the section header of the currently-viewed scope in the detail drawer (`text-accent`).
3. **Primary type signal** — agents, skills, MCP, and rules are "primary" config items and get `text-accent/50` on their type labels. Commands, settings, hooks, keybindings are secondary and get `text-text-dim`.

**Do not** use accent for: body copy, success states (use `bg-green-500`), warnings (use `bg-yellow-500`), decorative borders, hover backgrounds (use `bg-surface-hover`), error states (use `bg-red-500`/`text-red-400`).

### Borders

| Token | Value | Usage |
|---|---|---|
| `--color-border` | `rgba(255,255,255,0.06)` | Default. Card edges, section dividers, sidebar separator. |
| `--color-border-strong` | `rgba(255,255,255,0.12)` | Hover-emphasized borders. Rare. |

**Rule:** Borders should be *felt* more than seen. If a border is visible at a glance from arm's length, it's too strong.

### Semantic status colors

Not tokenized — use Tailwind's color palette directly, because these meanings are universal:

| State | Color | Usage |
|---|---|---|
| Idle / OK | `bg-green-500` | Session idle, healthy state, "all clear". |
| Working / active | `bg-cyan-400` + `animate-pulse` | Session running a tool call, in progress. |
| Needs attention | `bg-yellow-500` + `animate-pulse` | Session waiting for user input. |
| Dead / inactive | `bg-text-dim` (reuse dim token) | Session exited, unreachable, disabled. |
| Error | `text-red-400` / `bg-red-500/10` | Failure banners, PTY spawn errors. |

**Rule:** `animate-pulse` only on states that require user attention or show ongoing work. Idle and dead are static.

---

## Typography

### Families

Three font families, loaded via `next/font/google` in `src/app/layout.tsx`:

| Family | Token | Variable | Usage |
|---|---|---|---|
| Inter | `font-sans` | `--font-inter` | Default body text across the app. |
| Geist Mono | `font-mono` | `--font-geist-mono` | Config data, code, paths, type labels, terminal-adjacent UI, detail drawer content. |
| Fira Code | — | `--font-fira-code` (weight 700 only) | **Logo only.** The sidebar "MiClaw" wordmark. Never use elsewhere. |

### Scale

There is no fixed type scale — use Tailwind's utilities (`text-[10px]`, `text-xs`, `text-sm`, `text-base`) and be consistent within a surface. Common values observed in the codebase:

- `text-[10px]` — Type labels in detail drawer (`agent`, `cmd`), tab index numbers.
- `text-[11px]` — Secondary metadata in drawer (paths).
- `text-xs` (12px) — Badges, tab labels, section headers (`# agents`).
- `text-sm` (14px) — Card descriptions, row labels, item names in drawer.
- `text-base` (16px) — Drawer headings, primary card titles.

### When to use mono

Use `font-mono` (Geist Mono) for anything that represents a value in the filesystem or conversation log: agent names, skill names, paths, model IDs, session IDs, MCP commands, JSON keys, type labels. Anything the user could grep for should look greppable.

Use `font-sans` (Inter) for prose: page descriptions, tooltips, empty states, error message copy, button labels that describe an action ("Save", "Cancel", "Delete").

### Weight

- `font-medium` — badges, active nav states, card titles.
- `font-bold` — logo only.
- Default (regular) — everything else.

Avoid `font-semibold`. If you need more emphasis than `font-medium`, reach for contrast (brighter text token) or size before weight.

---

## Spacing & Radius

### Spacing

MiClaw uses Tailwind's default 4px-step spacing scale. Component-level conventions:

- Card padding: `p-5` (20px).
- Drawer padding: `px-5 py-2` inside scroll area, `px-5 pt-5 pb-3` in header.
- Tab: `px-3 py-2`.
- Badge: `px-2 py-0.5`.
- Icon button: `p-1.5`.
- Sidebar icon slot: `w-10 h-10`, `gap-2` between items.
- Section gaps: `mt-4 first:mt-0` for stacked sections inside a panel.

### Radius

MiClaw uses small radii — this is a developer tool, not a consumer app. The only large radius is the terminal (see Surfaces).

| Value | Usage |
|---|---|
| `rounded-sm` (2px) | Cards, badges, nav hover states, buttons — the default for nearly everything. |
| `rounded-md` (6px) | Sidebar icon slots, tooltip pills. |
| `rounded-full` | Status dots only. |
| `0.75rem` (12px) | Terminal viewport and canvas — matches the pane container. Override `.xterm-viewport` and `.xterm-screen canvas` in `globals.css`. |

**Rule:** Don't use `rounded-lg` or larger. If a panel feels like it needs a big radius, it probably doesn't belong in this app.

---

## Surfaces & Background Treatment

### The grid (identity-critical)

The 24px × 24px grid is one of the four identity pillars. It is not decoration and it is not optional.

```css
.bg-grid {
  background-image:
    linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
  background-size: 24px 24px;
}
```

Rules:

- The grid runs under the main content area via the `.bg-grid` utility on `<main>` in `src/app/layout.tsx`.
- The same grid overlays xterm terminals at slightly reduced opacity (`rgba(255,255,255,0.025)` vs. the base `0.03`) so it subtly reads through terminal output — see the `[data-miclaw-terminal]::after` rule in `globals.css`.
- Line opacity is deliberate: at `0.03` the grid is felt rather than seen. Do not raise it to make the grid "more visible" — if it's obtrusive, we've lost.
- Grid size is `24px` across the app. This matches Tailwind's `6` spacing unit and aligns with the sidebar nav rhythm. Don't introduce 16px, 32px, or any other grid.
- The grid survives into every future view. New full-page surfaces apply `bg-grid` on their outer container.

**Rule:** Don't add new background patterns. The grid is enough, and it is the only pattern in the app.

### Elevation

MiClaw has effectively two elevation levels: on-surface and raised. There are no true shadows except on the detail drawer:

```css
shadow-[-20px_0_60px_-15px_rgba(0,0,0,0.5)]
```

This is a directional shadow cast to the left, indicating the drawer is *over* the content it's covering. It's the only shadow in the app.

**Rule:** Don't add drop shadows to cards, buttons, or menus. Use `bg-surface-raised` for elevation instead.

---

## Motion & Animation

All custom keyframes live in `src/app/globals.css`. Transition timing defaults to `transition-colors` on hover (Tailwind's 150ms ease). Use custom animations sparingly — each must communicate a specific state.

### Keyframes (canonical)

| Animation | Duration | Easing | Triggered by | Meaning |
|---|---|---|---|---|
| `slideIn` | 300ms | `ease-out` | `DetailDrawer` mount | Drawer appears from the right edge. |
| `targetFlash` | 7s | `ease-out` | `:target` pseudo-class (hash nav) | Briefly highlights the card matching the URL fragment. |
| `pencilPulse` | 2s | `ease-in-out` infinite | `EditPencil` visible state | Pulsing terracotta signals "click me to edit." |
| `pulseGlow` | 2s | `ease-in-out` infinite | Selected node in `SphereView` / `TreeView` | Terracotta box-shadow glow signaling the current selection in the config visualizations. |
| `pulsePathGlow` | — | infinite | Tree view ancestor edges | Stroke-opacity pulse highlighting the lineage of the selected node. |

Built-in Tailwind `animate-pulse` is used for status dots (working, needs_input).

### Hover transitions

Use `transition-colors` for color/background changes on interactive elements. Use `transition-all duration-200` only when multiple properties animate together (e.g., `EditPencil` transitioning both color and opacity).

### Direct DOM manipulation

One exception to the React-driven animation rule: the pane resize handle (`PaneDivider.tsx`) mutates inline styles directly during drag for 60fps responsiveness, then commits the final ratio to React state on `mouseup`. This pattern is reserved for drag interactions where React reconciliation would cause jank.

**Rule:** Don't reach for direct DOM manipulation for anything else. If you think you need it, measure first.

---

## Iconography

- Icons come exclusively from `lucide-react`.
- Default icon size: `size={22}` for primary nav/action icons, `size={16}` for secondary/close icons, `size={12}` for inline badges and tab decorations.
- Never use emoji as icons. Emoji may appear in user content (agent/skill names) but never in MiClaw's own chrome.
- Icon color follows text color — don't set icon colors independently.

Nav icons in the sidebar map each top-level route to a domain-evocative lucide icon (`Bot` for agents, `Zap` for skills, `Terminal` for commands, `Plug` for MCP, `Webhook` for hooks, etc.). When adding a new route, pick an icon that reads at a glance.

---

## Component Patterns

### `Card` (`src/components/Card.tsx`)

The universal container for config items. Border-only elevation, small radius, generous padding.

```tsx
<div className="border border-border rounded-sm p-5">
```

When clickable, adds `cursor-pointer hover:border-accent/30 transition-colors`. The accent border on hover is the signal that the card is an interactive target.

### `Badge` (`src/components/Badge.tsx`)

Small pill for metadata — scope name, model, tool reference. Three variants:

- `default` — `bg-surface-raised text-text-muted`. Generic label.
- `accent` — `bg-accent/15 text-accent`. Emphasized (e.g., Opus model badge).
- `muted` — `bg-surface-raised text-text-dim`. Weak label (e.g., "Global" scope).

**Rule:** Never create a fourth variant without checking whether an existing one fits. If you find yourself reaching for `bg-red-500/10` in a badge, it's probably an error state, not a badge.

### `StatusDot` (in `src/components/PaneLeaf.tsx`)

Small circular indicator for session state. Sizes: `w-2 h-2` (small, in tab bar) or `w-2.5 h-2.5` (normal, in content headers). Color maps to turn state per the Semantic Status table above. `animate-pulse` only on `working` and `needs_input`.

### `EditPencil` (`src/components/EditPencil.tsx`)

Hover-reveal pencil icon that opens inline edit mode for a card. States:

- Hidden: `text-transparent pointer-events-none` — takes up space but invisible.
- Visible: `text-accent/60`, pulses via `pencilPulse` keyframe.
- Hover: `text-accent hover:bg-surface-hover`.

**Rule:** The pencil is MiClaw's signature edit affordance. Don't replace it with a different edit icon or add a full "Edit" button next to cards.

### `DetailDrawer` (`src/components/DetailDrawer.tsx`)

Right-side panel that slides in when a node is selected in the overview. Key characteristics:

- `bg-surface border-l border-border` — distinct from the main content surface.
- `shadow-[-20px_0_60px_-15px_rgba(0,0,0,0.5)]` — the app's only drop shadow.
- `animate-[slideIn_0.3s_ease-out]` on mount.
- Content is `font-mono` throughout to reinforce the config-file feel.
- Close button: `X` icon, `p-1.5`, muted-to-text color transition on hover.

### Scope sections (the config-file aesthetic)

Inside the drawer and on detail pages, config items are grouped by scope using a consistent pattern:

- Scope headers use `[brackets]`: `[Global]`, `[project-name]`, `[from parent-project]`.
- Type sections use `# hash-prefix`: `# agents`, `# skills`, `# commands`.
- Type labels abbreviate to monospace-friendly tokens: `agent`, `skill`, `cmd`, `mcp`, `rule`, `config`, `hook`, `keys`, `style`.
- Primary types (`agent`, `skill`, `mcp`, `rule`) get `text-accent/50` on the type label and `text-text` on the value. Secondary types (`cmd`, `setting`, `hook`, `keybinding`, `output-style`) get `text-text-dim` on the label and `text-text-muted` on the value.
- Inherited items (shown in descendants) are separated by `border-t border-border` and labeled `[from <parent>]` in `text-text-dim`.

**Rule:** If you add a new config type, decide whether it's "primary" (a thing the user actively authors) or "secondary" (a passive setting), and map its color treatment accordingly.

### Sidebar

64px wide (`w-16`), fixed on the left, `border-r border-border`. Each nav slot is `w-10 h-10 rounded-md`. Active state: `text-accent bg-surface-raised`. Inactive hover: `text-text hover:bg-surface-hover`. Tooltips appear on hover to the right of the icon, `bg-surface-raised` with a subtle border.

Logo: vertical orientation (`writing-mode: vertical-lr`), Fira Code 700, "Mi" in `text-text-muted` and "Claw" in `text-accent`. This is the only place Fira Code is used.

---

## Layout Principles

- **The main canvas is full height.** `flex h-screen overflow-hidden` on the container, with the sidebar fixed and main content scrollable. No sticky headers, no fixed footers.
- **Drawer pushes content left** via a `marginRight` transition on the main content, not by overlaying. This preserves reading position and keeps both views navigable.
- **Pages have breathing room.** `PageWrapper` adds consistent outer padding. Detail pages use `ScopeHeader` for scope badge + path display.
- **Scope before content.** Every config view leads with scope (`[Global]` or `[project-name] path/`) so the user always knows whose config they're looking at.

---

## Voice & Microcopy

- **Terse.** Button labels are single words where possible ("Save", "Cancel", "Adopt", "Kill"). Tooltips can be a short sentence.
- **Developer-literate.** Use the real words: `PID`, `PTY`, `tmux`, `JSONL`, `frontmatter`. Don't translate technical terms for a non-technical audience.
- **Filesystem-honest.** When showing paths, shorten `/Users/<name>/` to `~/` but otherwise show the real path. Never invent or paraphrase directory names.
- **No marketing voice.** No exclamation points, no "great!" no emoji in chrome. Error messages state the problem and, where possible, the fix ("PTY spawn failed. Run: chmod +x …").

---

## Checklist for New UI

Before adding a new component or page, confirm:

- [ ] The four identity pillars are intact: Claude terracotta accent, warm black surface, Gruvbox-adjacent neutrals, 24px grid visible where the view is full-canvas.
- [ ] Colors reference tokens (`bg-surface`, `text-text-muted`, etc.), no raw hex.
- [ ] No cool greys (`slate-*`, `zinc-*`, `gray-*`) — warm neutrals only.
- [ ] No gradients, glass, or blur effects — flat warm black with subtle borders.
- [ ] Typography uses `font-sans` or `font-mono` appropriately — mono for filesystem-y values.
- [ ] The accent color appears only for selection, editable affordance, or primary-type distinction — not decoration.
- [ ] Interactive states use `transition-colors` (or `transition-all duration-200` for multi-property).
- [ ] Custom animations are registered as keyframes in `globals.css` and carry meaning (status, affordance, continuity).
- [ ] Borders use `border-border` (the subtle default), not a new raw color.
- [ ] Radii are `rounded-sm` or `rounded-md` unless it's a terminal.
- [ ] Icons come from `lucide-react` at standard sizes (12/16/22).
- [ ] Text hierarchy uses three tokens at most (`text`, `text-muted`, `text-dim`).
- [ ] If the surface is a scope or config item, it leads with a `[scope]` header and uses the config-file aesthetic.

---

## Changing the System

Changes to the design language should be deliberate and centralized:

1. **New color:** Add it to `@theme inline` in `globals.css`, document it in this file, search-and-verify it's used in at least two places before promoting it to a token.
2. **New animation:** Add the keyframe to `globals.css`, register it in the Motion table above with its meaning.
3. **New icon size:** Don't. Use 12, 16, or 22.
4. **New radius:** Don't. Use `rounded-sm`, `rounded-md`, or `rounded-full`.
5. **Breaking an existing pattern** (e.g., introducing a different edit affordance, a second accent): open a discussion first — these patterns are load-bearing across the app.

Keep the system small. Most design decisions in MiClaw should be "pick from the list of things that already exist," not "invent something new."
