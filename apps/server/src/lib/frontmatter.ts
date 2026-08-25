import yaml from 'js-yaml';

export interface FrontMatter {
  title?: string;
  slug?: string;
  summary?: string;
  tags?: string[];
  category?: string;
  visibility?: string;
}

/** 解析 Markdown 文件头的 --- yaml --- 段 */
export function parseFrontMatter(text: string): { data: Record<string, unknown>; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return { data: {}, body: text };
  let data: Record<string, unknown> = {};
  try {
    const loaded = yaml.load(m[1]!);
    if (loaded && typeof loaded === 'object' && !Array.isArray(loaded)) {
      data = loaded as Record<string, unknown>;
    }
  } catch {
    data = {};
  }
  return { data, body: text.slice(m[0].length) };
}

export function normalizeTagList(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.map((t) => String(t).trim()).filter(Boolean).slice(0, 20);
  }
  if (typeof v === 'string') {
    return v
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 20);
  }
  return [];
}