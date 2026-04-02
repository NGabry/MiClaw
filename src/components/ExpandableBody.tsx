"use client";

import { useState } from "react";

interface ExpandableBodyProps {
  content: string;
  previewLines?: number;
}

export function ExpandableBody({
  content,
  previewLines = 4,
}: ExpandableBodyProps) {
  const [expanded, setExpanded] = useState(false);
  const lines = content.split("\n");
  const needsTruncation = lines.length > previewLines;
  const displayContent = expanded
    ? content
    : lines.slice(0, previewLines).join("\n");

  return (
    <div className="mt-3">
      <pre className="text-xs text-text-muted font-mono whitespace-pre-wrap leading-relaxed">
        {displayContent}
        {!expanded && needsTruncation && (
          <span className="text-text-dim">...</span>
        )}
      </pre>
      {needsTruncation && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-xs text-accent hover:text-accent-dim transition-colors"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
