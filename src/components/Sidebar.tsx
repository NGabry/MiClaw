"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  Zap,
  Terminal,
  Shield,
  FileText,
  Plug,
  Webhook,
  Activity,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/sessions", label: "Sessions", icon: Activity },
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/rules", label: "Rules", icon: FileText },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/skills", label: "Skills", icon: Zap },
  { href: "/commands", label: "Commands", icon: Terminal },
  { href: "/mcp", label: "MCP Servers", icon: Plug },
  { href: "/hooks", label: "Hooks", icon: Webhook },
  { href: "/settings", label: "Settings", icon: Shield },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="w-16 shrink-0 border-r border-border py-4 flex flex-col items-center gap-2 overflow-visible">
      {/* Title */}
      <Link href="/" className="mb-3" style={{ writingMode: "vertical-lr" }}>
        <span className="text-sm font-bold tracking-wider" style={{ fontFamily: "var(--font-fira-code), monospace" }}>
          <span className="text-text-muted">Mi</span>
          <span className="text-accent">Claw</span>
        </span>
      </Link>

      {/* Nav icons */}
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive =
          href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`relative group w-10 h-10 flex items-center justify-center rounded-md transition-colors
              ${isActive
                ? "text-accent bg-surface-raised"
                : "text-text-dim hover:text-text hover:bg-surface-hover"}`}
          >
            <Icon size={22} />
            <span className="absolute left-full ml-3 px-2.5 py-1 rounded-md bg-surface-raised border border-border
              text-text text-xs font-medium whitespace-nowrap
              opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-lg">
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
