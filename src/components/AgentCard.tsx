"use client";

import { useState, useRef } from "react";
import type { Agent } from "@/lib/types";
import { Card } from "./Card";
import { ExpandableBody } from "./ExpandableBody";
import { X, Trash2 } from "lucide-react";
import { EditPencil } from "./EditPencil";
import { saveAgent, deleteItem } from "@/lib/actions";

export function AgentCard({ agent, scopePath, scopeType }: {
  agent: Agent;
  scopePath: string;
  scopeType: "global" | "project";
}) {
  const { frontmatter, body } = agent;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hovered, setHovered] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSave(formData: FormData) {
    setSaving(true);
    const result = await saveAgent(formData);
    setSaving(false);
    if (result.success) {
      setEditing(false);
    } else {
      alert(result.error ?? "Failed to save");
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete agent "${frontmatter.name}"?`)) return;
    const formData = new FormData();
    formData.set("filePath", agent.filePath);
    formData.set("itemType", "agent");
    await deleteItem(formData);
  }

  if (editing) {
    return (
      <Card id={frontmatter.name} className="border-accent/30">
        <form ref={formRef} action={handleSave}>
          <input type="hidden" name="scopeType" value={scopeType} />
          <input type="hidden" name="scopePath" value={scopePath} />
          <input type="hidden" name="filePath" value={agent.filePath} />

          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono text-text-dim">editing agent</span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={handleDelete}
                className="p-1 rounded-sm text-text-dim hover:text-red-400 hover:bg-surface-hover transition-colors"
              >
                <Trash2 size={13} />
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
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
                defaultValue={frontmatter.name}
                required
                className="w-full bg-surface-raised border border-border rounded-sm px-3 py-1.5 text-sm font-mono text-text
                  focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-text-dim mb-1">description</label>
              <input
                name="description"
                defaultValue={frontmatter.description}
                required
                className="w-full bg-surface-raised border border-border rounded-sm px-3 py-1.5 text-sm font-mono text-text
                  focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-text-dim mb-1">model</label>
              <select
                name="model"
                defaultValue={frontmatter.model ?? ""}
                className="w-full bg-surface-raised border border-border rounded-sm px-3 py-1.5 text-sm font-mono text-text
                  focus:border-accent focus:outline-none"
              >
                <option value="">inherit</option>
                <option value="opus">opus</option>
                <option value="sonnet">sonnet</option>
                <option value="haiku">haiku</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-mono text-text-dim mb-1">body</label>
              <textarea
                name="body"
                defaultValue={body}
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
            {saving ? "Saving..." : "Save"}
          </button>
        </form>
      </Card>
    );
  }

  return (
    <Card id={frontmatter.name} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-mono font-medium text-text">{frontmatter.name}</h3>
          {frontmatter.model && <span className="font-mono text-xs text-text-dim">{frontmatter.model}</span>}
        </div>
        <EditPencil visible={hovered} onClick={() => setEditing(true)} />
      </div>

      <p className="mt-1.5 text-sm text-text-muted leading-relaxed">
        {frontmatter.description}
      </p>

      {body && <ExpandableBody content={body} />}
    </Card>
  );
}
