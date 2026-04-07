"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const POLL_INTERVAL = 1000;
const MAX_LINES = 300;

/**
 * Terminal ANSI palette -- maps Claude Code's dark-ansi theme to actual colors.
 * These come from the /api/sessions/colors endpoint (reads Terminal.app plist).
 */
interface TermPalette {
  background: string;
  foreground: string;
  bold: string;
  selection: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

interface LineStyle {
  text: string;
  color?: string;
  bg?: string;
  dim?: boolean;
}

/**
 * Tag each line with a "block" type so we can apply background colors
 * to user message regions (prompt through next agent marker).
 */
function classifyLines(lines: string[], p: TermPalette | null): LineStyle[] {
  const result: LineStyle[] = [];
  let inUserBlock = false;
  const userBg = p?.brightBlack;

  for (const line of lines) {
    const trimmed = line.trimStart();

    if (trimmed.startsWith("\u276F ") || trimmed.startsWith("> ")) {
      inUserBlock = true;
      result.push({ text: line, color: p?.white, bg: userBg });
      continue;
    }

    if (trimmed.startsWith("\u23FA ") || trimmed.startsWith("\u25CF ") || /^[\u2500\u2501]{3,}/.test(trimmed) || /^[\u273D\u280B\u2819\u2839\u2838\u283C\u2834\u2826\u2827\u2807\u280F\u2810\u2802\u2801]/.test(trimmed)) {
      inUserBlock = false;
    }

    if (inUserBlock && trimmed === "") {
      inUserBlock = false;
    }

    if (/^[\u2500\u2501]{3,}/.test(trimmed)) {
      result.push({ text: line, dim: true });
      continue;
    }

    if (/^[\u273D\u280B\u2819\u2839\u2838\u283C\u2834\u2826\u2827\u2807\u280F\u2810\u2802\u2801]/.test(trimmed) || /Saut[e\u00e9]ing|Brewing|Brewed|Frosting|Compiled|Cogitat|Waddling|Worked for/.test(trimmed)) {
      result.push({ text: line, color: p?.brightRed });
      continue;
    }

    if (inUserBlock) {
      result.push({ text: line, bg: userBg });
      continue;
    }

    result.push({ text: line });
  }

  return result;
}

/**
 * Strip the bottom prompt area from terminal output
 */
function stripPromptArea(lines: string[]): string[] {
  let end = lines.length;

  while (end > 0) {
    const trimmed = lines[end - 1].trim();
    if (trimmed === "") { end--; continue; }
    if (/⏵⏵|accept edits|Do you want to proceed|esc to interrupt/.test(trimmed)) { end--; continue; }
    if (/^[─━]{3,}$/.test(trimmed)) { end--; continue; }
    if (/^[❯>]\s*$/.test(trimmed)) { end--; continue; }
    break;
  }

  return lines.slice(0, end);
}

export function TerminalMirror({ pid, fillHeight }: { pid: number; fillHeight?: boolean }) {
  const [screen, setScreen] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [palette, setPalette] = useState<TermPalette | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevScreenRef = useRef<string>("");
  const isAtBottomRef = useRef(true);

  // Fetch terminal color palette once
  useEffect(() => {
    const fetchColors = async () => {
      try {
        const res = await fetch("/api/sessions/colors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pid }),
        });
        if (res.ok) {
          setPalette(await res.json());
        }
      } catch { /* use defaults */ }
    };
    const t = setTimeout(fetchColors, 0);
    return () => clearTimeout(t);
  }, [pid]);

  const fetchScreen = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions/screen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pid }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.screen && data.screen !== prevScreenRef.current) {
          prevScreenRef.current = data.screen;
          const lines = data.screen.split("\n");
          const trimmed = lines.length > MAX_LINES
            ? lines.slice(-MAX_LINES).join("\n")
            : data.screen;
          setScreen(trimmed);
          setError(null);
          if (isAtBottomRef.current) {
            setTimeout(() => {
              if (containerRef.current) {
                containerRef.current.scrollTop = containerRef.current.scrollHeight;
              }
            }, 10);
          }
        }
      }
    } catch {
      setError("Failed to fetch terminal screen");
    }
  }, [pid]);

  useEffect(() => {
    const interval = setInterval(fetchScreen, POLL_INTERVAL);
    const initial = setTimeout(fetchScreen, 0);
    return () => { clearInterval(interval); clearTimeout(initial); };
  }, [fetchScreen]);

  function handleScroll() {
    if (!containerRef.current) return;
    const el = containerRef.current;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
  }

  if (error) {
    return <p className="text-xs font-mono text-red-400 p-2">{error}</p>;
  }

  if (!screen) {
    return <p className="text-xs font-mono text-text-dim p-4">Loading terminal...</p>;
  }

  const rawLines = screen.split("\n");
  const strippedLines = stripPromptArea(rawLines);
  const styledLines = classifyLines(strippedLines, palette);

  return (
    <div
      ref={containerRef}
      data-terminal-mirror
      onScroll={handleScroll}
      className="overflow-y-auto overflow-x-auto font-mono text-[12px] leading-[1.5] rounded-sm border border-border"
      style={{
        ...(fillHeight
          ? { height: "100%", minHeight: 0 }
          : { maxHeight: "350px" }),
        backgroundColor: palette?.background ?? "#1d1d1d",
        color: palette?.foreground ?? "#fdcd9f",
      }}
    >
      <div className="p-3 min-w-[600px]">
        {styledLines.map((ls, i) => (
          <div
            key={i}
            className="whitespace-pre"
            style={{
              ...(ls.color ? { color: ls.color } : {}),
              ...(ls.bg ? { backgroundColor: ls.bg, marginLeft: "-0.75rem", marginRight: "-0.75rem", paddingLeft: "0.75rem", paddingRight: "0.75rem" } : {}),
              ...(ls.dim ? { opacity: 0.4 } : {}),
            }}
          >
            {ls.text || "\u00A0"}
          </div>
        ))}
      </div>
    </div>
  );
}
