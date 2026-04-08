"use client";

import { useCallback, useRef } from "react";

interface PaneDividerProps {
  direction: "horizontal" | "vertical";
  splitId: string;
  onResizeCommit: (splitId: string, ratio: number) => void;
}

export function PaneDivider({ direction, splitId, onResizeCommit }: PaneDividerProps) {
  const barRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const bar = barRef.current;
      if (!bar) return;
      const container = bar.parentElement;
      if (!container) return;

      // Grab siblings (first-child and last-child of the flex container)
      const children = Array.from(container.children).filter(
        (el) => el !== bar,
      ) as HTMLElement[];
      if (children.length < 2) return;
      const [first, second] = children;

      const isHorizontal = direction === "horizontal";
      const containerRect = container.getBoundingClientRect();
      const containerSize = isHorizontal ? containerRect.width : containerRect.height;

      // Prevent text selection during drag
      document.body.style.userSelect = "none";
      document.body.style.cursor = isHorizontal ? "col-resize" : "row-resize";

      const MIN_PX = 200;

      function onPointerMove(ev: PointerEvent) {
        const pos = isHorizontal
          ? ev.clientX - containerRect.left
          : ev.clientY - containerRect.top;
        const clamped = Math.max(MIN_PX, Math.min(containerSize - MIN_PX, pos));
        const ratio = clamped / containerSize;

        // Direct DOM manipulation for smooth 60fps resizing
        first.style.flexBasis = `${ratio * 100}%`;
        second.style.flexBasis = `${(1 - ratio) * 100}%`;
      }

      function onPointerUp(ev: PointerEvent) {
        document.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("pointerup", onPointerUp);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";

        // Compute final ratio and commit to React state
        const pos = isHorizontal
          ? ev.clientX - containerRect.left
          : ev.clientY - containerRect.top;
        const clamped = Math.max(MIN_PX, Math.min(containerSize - MIN_PX, pos));
        onResizeCommit(splitId, clamped / containerSize);
      }

      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
    },
    [direction, splitId, onResizeCommit],
  );

  const isHorizontal = direction === "horizontal";

  return (
    <div
      ref={barRef}
      onPointerDown={handlePointerDown}
      className="relative shrink-0 group"
      style={{
        [isHorizontal ? "width" : "height"]: "4px",
        cursor: isHorizontal ? "col-resize" : "row-resize",
      }}
    >
      {/* Visible bar */}
      <div
        className="absolute bg-border group-hover:bg-border-strong transition-colors"
        style={
          isHorizontal
            ? { top: 0, bottom: 0, left: 0, width: "4px" }
            : { left: 0, right: 0, top: 0, height: "4px" }
        }
      />
      {/* Transparent hit area */}
      <div
        className="absolute"
        style={
          isHorizontal
            ? { top: 0, bottom: 0, left: "-4px", width: "12px" }
            : { left: 0, right: 0, top: "-4px", height: "12px" }
        }
      />
    </div>
  );
}
