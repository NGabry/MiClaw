import matter from "gray-matter";

export interface ParsedMarkdown<T = Record<string, unknown>> {
  frontmatter: T;
  body: string;
}

export function parseMarkdownWithFrontmatter<T = Record<string, unknown>>(
  content: string
): ParsedMarkdown<T> {
  const { data, content: body } = matter(content);
  return {
    frontmatter: data as T,
    body: body.trim(),
  };
}

export function extractAgentReferences(
  skillBody: string,
  knownAgentNames: string[]
): string[] {
  const found: string[] = [];
  for (const name of knownAgentNames) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`\\b${escaped}\\b`, "i");
    if (pattern.test(skillBody)) {
      found.push(name);
    }
  }
  return found;
}
