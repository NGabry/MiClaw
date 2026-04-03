"use client";

import { useState, useRef } from "react";
import type { Skill } from "@/lib/types";
import { Card } from "./Card";
import { ExpandableBody } from "./ExpandableBody";
import { X, Trash2 } from "lucide-react";
import { EditPencil } from "./EditPencil";
import { saveSkill, deleteItem } from "@/lib/actions";

export function SkillCard({ skill, scopePath, scopeType, isNew, onCancel }: {
  skill?: Skill;
  scopePath: string;
  scopeType: "global" | "project";
  isNew?: boolean;
  onCancel?: () => void;
}) {
  const frontmatter = skill?.frontmatter;
  const body = skill?.body;
  const [editing, setEditing] = useState(!!isNew);
  const [saving, setSaving] = useState(false);
  const [hovered, setHovered] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSave(formData: FormData) {
    setSaving(true);
    const result = await saveSkill(formData);
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
    if (!skill || !frontmatter) return;
    if (!window.confirm(`Delete skill "${frontmatter.name}"?`)) return;
    const formData = new FormData();
    formData.set("filePath", skill.filePath);
    formData.set("itemType", "skill");
    await deleteItem(formData);
  }

  if (editing) {
    const isCreating = !skill;
    return (
      <Card id={frontmatter?.name ?? "new-skill"} className="border-accent/30">
        <form ref={formRef} action={handleSave}>
          <input type="hidden" name="scopeType" value={scopeType} />
          <input type="hidden" name="scopePath" value={scopePath} />
          {skill && <input type="hidden" name="filePath" value={skill.filePath} />}

          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono text-text-dim">
              {isCreating ? "new skill" : "editing skill"}
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
                defaultValue={frontmatter?.name ?? ""}
                required
                className="w-full bg-surface-raised border border-border rounded-sm px-3 py-1.5 text-sm font-mono text-text
                  focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-text-dim mb-1">description</label>
              <input
                name="description"
                defaultValue={frontmatter?.description ?? ""}
                required
                className="w-full bg-surface-raised border border-border rounded-sm px-3 py-1.5 text-sm font-mono text-text
                  focus:border-accent focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                name="userInvocable"
                defaultChecked={frontmatter?.["user-invocable"] ?? false}
                className="accent-accent"
              />
              <label className="text-[10px] font-mono text-text-dim">user-invocable</label>
            </div>
            <div>
              <label className="block text-[10px] font-mono text-text-dim mb-1">argument-hint</label>
              <input
                name="argumentHint"
                defaultValue={frontmatter?.["argument-hint"] ?? ""}
                className="w-full bg-surface-raised border border-border rounded-sm px-3 py-1.5 text-sm font-mono text-text
                  focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-text-dim mb-1">body</label>
              <textarea
                name="body"
                defaultValue={body ?? ""}
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

  if (!frontmatter) return null;

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
