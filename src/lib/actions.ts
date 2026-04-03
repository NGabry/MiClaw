"use server";

import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import { revalidatePath } from "next/cache";
import { HOME_DIR, GLOBAL_AGENTS_DIR, GLOBAL_SKILLS_DIR } from "./constants";

// --- Security: validate write path ---

function isValidWritePath(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  return resolved.startsWith(HOME_DIR) && resolved.includes(".claude");
}

// --- Helpers ---

async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

function revalidateAll(): void {
  revalidatePath("/");
  revalidatePath("/agents");
  revalidatePath("/skills");
  revalidatePath("/commands");
  revalidatePath("/settings");
  revalidatePath("/rules");
  revalidatePath("/mcp");
  revalidatePath("/hooks");
}

// --- Save Agent ---

export async function saveAgent(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const model = formData.get("model") as string;
  const body = formData.get("body") as string;
  const scopeType = formData.get("scopeType") as string;
  const scopePath = formData.get("scopePath") as string;
  const originalFilePath = formData.get("filePath") as string | null;

  if (!name || !description) {
    return { success: false, error: "Name and description are required" };
  }

  // Build frontmatter
  const frontmatter: Record<string, unknown> = {
    name,
    description,
  };
  if (model) frontmatter.model = model;

  // Determine write path
  const dir = scopeType === "global"
    ? GLOBAL_AGENTS_DIR
    : path.join(scopePath, ".claude", "agents");
  const filePath = path.join(dir, `${name}.md`);

  if (!isValidWritePath(filePath)) {
    return { success: false, error: "Invalid write path" };
  }

  try {
    await ensureDir(dir);
    const content = matter.stringify(body || "", frontmatter);
    await fs.writeFile(filePath, content, "utf-8");

    // If name changed (rename), delete old file
    if (originalFilePath && originalFilePath !== filePath) {
      if (isValidWritePath(originalFilePath)) {
        await fs.unlink(originalFilePath).catch(() => {});
      }
    }

    revalidateAll();
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// --- Save Skill ---

export async function saveSkill(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const userInvocable = formData.get("userInvocable") === "on";
  const argumentHint = formData.get("argumentHint") as string;
  const body = formData.get("body") as string;
  const scopeType = formData.get("scopeType") as string;
  const scopePath = formData.get("scopePath") as string;
  const originalFilePath = formData.get("filePath") as string | null;

  if (!name || !description) {
    return { success: false, error: "Name and description are required" };
  }

  const frontmatter: Record<string, unknown> = {
    name,
    description,
  };
  if (userInvocable) frontmatter["user-invocable"] = true;
  if (argumentHint) frontmatter["argument-hint"] = argumentHint;

  // Skills live in a subdirectory: {scope}/skills/{name}/SKILL.md
  const baseDir = scopeType === "global"
    ? GLOBAL_SKILLS_DIR
    : path.join(scopePath, ".claude", "skills");
  const skillDir = path.join(baseDir, name);
  const filePath = path.join(skillDir, "SKILL.md");

  if (!isValidWritePath(filePath)) {
    return { success: false, error: "Invalid write path" };
  }

  try {
    await ensureDir(skillDir);
    const content = matter.stringify(body || "", frontmatter);
    await fs.writeFile(filePath, content, "utf-8");

    // If name changed, delete old skill directory
    if (originalFilePath && originalFilePath !== filePath) {
      const oldDir = path.dirname(originalFilePath);
      if (isValidWritePath(oldDir)) {
        await fs.rm(oldDir, { recursive: true }).catch(() => {});
      }
    }

    revalidateAll();
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// --- Save Command ---

export async function saveCommand(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const name = formData.get("name") as string;
  const body = formData.get("body") as string;
  const scopePath = formData.get("scopePath") as string;
  const originalFilePath = formData.get("filePath") as string | null;

  if (!name) {
    return { success: false, error: "Name is required" };
  }

  const dir = path.join(scopePath, ".claude", "commands");
  const filePath = path.join(dir, `${name}.md`);

  if (!isValidWritePath(filePath)) {
    return { success: false, error: "Invalid write path" };
  }

  try {
    await ensureDir(dir);
    await fs.writeFile(filePath, body || "", "utf-8");

    if (originalFilePath && originalFilePath !== filePath) {
      if (isValidWritePath(originalFilePath)) {
        await fs.unlink(originalFilePath).catch(() => {});
      }
    }

    revalidateAll();
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// --- Save Instruction File ---

export async function saveInstructionFile(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const filePath = formData.get("filePath") as string;
  const content = formData.get("content") as string;

  if (!filePath) {
    return { success: false, error: "File path is required" };
  }

  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(HOME_DIR)) {
    return { success: false, error: "Invalid write path" };
  }

  try {
    await fs.writeFile(resolved, content, "utf-8");
    revalidateAll();
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// --- Delete Item ---

export async function deleteItem(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const filePath = formData.get("filePath") as string;
  const itemType = formData.get("itemType") as string;

  if (!filePath || !isValidWritePath(filePath)) {
    return { success: false, error: "Invalid file path" };
  }

  try {
    if (itemType === "skill") {
      // Delete the entire skill directory
      const skillDir = path.dirname(filePath);
      await fs.rm(skillDir, { recursive: true });
    } else {
      await fs.unlink(filePath);
    }

    revalidateAll();
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
