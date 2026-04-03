"use client";

import { useState, useRef } from "react";
import { Card } from "./Card";
import { ExpandableBody } from "./ExpandableBody";
import { Badge } from "./Badge";
import { X } from "lucide-react";
import { EditPencil } from "./EditPencil";
import { saveInstructionFile } from "@/lib/actions";

export function RuleCard({ filePath, type, content }: {
  filePath: string;
  type: string;
  content: string;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hovered, setHovered] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSave(formData: FormData) {
    setSaving(true);
    const result = await saveInstructionFile(formData);
    setSaving(false);
    if (result.success) {
      setEditing(false);
    } else {
      alert(result.error ?? "Failed to save");
    }
  }

  if (editing) {
    return (
      <Card className="border-accent/30">
        <form ref={formRef} action={handleSave}>
          <input type="hidden" name="filePath" value={filePath} />

          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono text-text-dim">editing instruction file</span>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="p-1 rounded-sm text-text-dim hover:text-text hover:bg-surface-hover transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <Badge variant="default">{type}</Badge>
            <span className="text-xs text-text-dim font-mono">{filePath}</span>
          </div>

          <textarea
            name="content"
            defaultValue={content}
            rows={24}
            className="w-full bg-surface-raised border border-border rounded-sm px-3 py-1.5 text-sm font-mono text-text
              focus:border-accent focus:outline-none resize-y"
          />

          <button
            type="submit"
            disabled={saving}
            className="mt-4 w-full py-2 bg-accent text-surface font-mono text-sm font-medium
              rounded-sm hover:bg-accent-dim transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </form>
      </Card>
    );
  }

  return (
    <Card onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="default">{type}</Badge>
          <span className="text-xs text-text-dim font-mono">{filePath}</span>
        </div>
        <EditPencil visible={hovered} onClick={() => setEditing(true)} />
      </div>
      <ExpandableBody content={content} previewLines={8} />
    </Card>
  );
}
