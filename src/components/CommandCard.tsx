"use client";

import { useState, useRef } from "react";
import type { Command } from "@/lib/types";
import { Card } from "./Card";
import { ExpandableBody } from "./ExpandableBody";
import { X, Trash2 } from "lucide-react";
import { EditPencil } from "./EditPencil";
import { saveCommand, deleteItem } from "@/lib/actions";

export function CommandCard({ command, scopePath, isNew, onCancel }: {
  command?: Command;
  scopePath: string;
  isNew?: boolean;
  onCancel?: () => void;
}) {
  const [editing, setEditing] = useState(!!isNew);
  const [saving, setSaving] = useState(false);
  const [hovered, setHovered] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSave(formData: FormData) {
    setSaving(true);
    const result = await saveCommand(formData);
    setSaving(false);
    if (result.success) {
      setEditing(false);
    } else {
      alert(result.error ?? "Failed to save");
    }
  }

  function handleCancel() {
    if (isNew) {
      onCancel?.();
    } else {
      setEditing(false);
    }
  }

  async function handleDelete() {
    if (!command) return;
    if (!window.confirm(`Delete command "${command.name}"?`)) return;
    const formData = new FormData();
    formData.set("filePath", command.filePath);
    formData.set("itemType", "command");
    await deleteItem(formData);
  }

  if (editing) {
    const isCreating = !command;
    return (
      <Card id={command?.name ?? "new-command"} className="border-accent/30">
        <form ref={formRef} action={handleSave}>
          <input type="hidden" name="scopePath" value={scopePath} />
          {command && <input type="hidden" name="filePath" value={command.filePath} />}

          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono text-text-dim">
              {isCreating ? "new command" : "editing command"}
            </span>
            <div className="flex gap-1">
              {!isCreating && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="p-1 rounded-sm text-text-dim hover:text-red-400 hover:bg-surface-hover transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              )}
              <button
                type="button"
                onClick={handleCancel}
                className="p-1 rounded-sm text-text-dim hover:text-text hover:bg-surface-hover transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-mono text-text-dim mb-1">name</label>
              <input
                name="name"
                defaultValue={command?.name ?? ""}
                required
                className="w-full bg-surface-raised border border-border rounded-sm px-3 py-1.5 text-sm font-mono text-text
                  focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-text-dim mb-1">body</label>
              <textarea
                name="body"
                defaultValue={command?.body ?? ""}
                rows={16}
                className="w-full bg-surface-raised border border-border rounded-sm px-3 py-1.5 text-sm font-mono text-text
                  focus:border-accent focus:outline-none resize-y"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="mt-4 w-full py-2 bg-accent text-surface font-mono text-sm font-medium
              rounded-sm hover:bg-accent-dim transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : isCreating ? "Create" : "Save"}
          </button>
        </form>
      </Card>
    );
  }

  if (!command) return null;

  return (
    <Card id={command.name} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div className="flex items-start justify-between">
        <h3 className="text-sm font-mono font-medium">{command.name}</h3>
        <EditPencil visible={hovered} onClick={() => setEditing(true)} />
      </div>

      <ExpandableBody content={command.body} previewLines={3} />
    </Card>
  );
}
