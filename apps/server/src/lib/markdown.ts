import MarkdownIt from 'markdown-it';
import anchor from 'markdown-it-anchor';
import { full as emoji } from 'markdown-it-emoji';
import taskLists from 'markdown-it-task-lists';
import footnote from 'markdown-it-footnote';
import sub from 'markdown-it-sub';
import sup from 'markdown-it-sup';
import linkAttributes from 'markdown-it-link-attributes';
import katex from '@vscode/markdown-it-katex';
import hljs from 'highlight.js';
import DOMPurify from 'isomorphic-dompurify';
import { pinyin } from 'pinyin-pro';

export interface TocItem {
  level: number;
  id: string;
  text: string;
}

export interface CompileResult {
  html: string;
  text: string;
  toc: TocItem[];
  wordCount: number;
  cover: string | null;
}

export function slugifyHeading(text: string): string {
  const arr = pinyin(text, { toneType: 'none', type: 'array', nonZh: 'consecutive' });
  return (
    arr
      .join('-')
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '') || 'h'
  );
}

const md: MarkdownIt = new MarkdownIt({
  html: true, // 原始 HTML 保留，最终统一由 DOMPurify 消毒
  linkify: true,
  typographer: true,
  highlight(str, lang) {
    const name = lang?.replace(/^language-/, '');
    if (name && hljs.getLanguage(name)) {
      try {
        return (
          '<pre><code class="hljs language-' +
          name +
          '">' +
          hljs.highlight(str, { language: name, ignoreIllegals: true }).value +
          '</code></pre>'
        );
      } catch {
        // fallthrough
      }
    }
    return '<pre><code class="hljs">' + md.utils.escapeHtml(str) + '</code></pre>';
  },
});


/** markdown-it 插件可能是 dual 包（default 嵌套），统一取实际函数 */
function pluginFn(p: unknown): (md: MarkdownIt) => void {
  const cand = (p as { default?: unknown }).default ?? p;
  return (typeof cand === 'function' ? cand : p) as (md: MarkdownIt) => void;
}

md.use(pluginFn(anchor), { slugify: slugifyHeading, tabIndex: false, permalink: false });
md.use(pluginFn(taskLists), { enabled: false });
md.use(pluginFn(emoji));
md.use(pluginFn(footnote));
md.use(pluginFn(sub));
md.use(pluginFn(sup));
md.use(pluginFn(linkAttributes), {
  matcher: (href: string) => /^https?:\/\//i.test(href),
  attrs: { target: '_blank', rel: 'noopener nofollow' },
});
md.use(pluginFn(katex), { throwOnError: false, errorColor: '#cc0000' });

export function compileMarkdown(mdText: string): CompileResult {
  const rendered = md.render(mdText ?? '');
  const sanitized = DOMPurify.sanitize(rendered, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'rel', 'loading', 'decoding', 'width', 'height', 'class', 'id', 'style', 'colspan', 'rowspan', 'start'],
  });
  // 图片懒加载
  const html = sanitized.replace(/<img /g, '<img loading="lazy" decoding="async" ');
  const text = htmlToText(html);
  return {
    html,
    text,
    toc: extractToc(html),
    wordCount: countWords(text),
    cover: extractFirstImage(html),
  };
}

function extractToc(html: string): TocItem[] {
  const items: TocItem[] = [];
  const re = /<h([1-6])[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    items.push({ level: Number(m[1]), id: m[2]!, text: stripTags(m[3]!) });
  }
  return items;
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function countWords(text: string): number {
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const latin = text
    .replace(/[\u4e00-\u9fff]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return cjk + latin;
}

function extractFirstImage(html: string): string | null {
  const m = /<img[^>]+src="([^"]+)"/.exec(html);
  return m ? m[1]! : null;
}

/** 摘要：取纯文本前 200 字 */
export function makeSummary(text: string, max = 200): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return t.slice(0, max) + '…';
}