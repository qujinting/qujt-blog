import { describe, expect, it } from 'vitest';
import { compileMarkdown, countWords, makeSummary } from '../src/lib/markdown.js';

describe('MD 编译管线', () => {
  it('标题与 TOC 提取', () => {
    const res = compileMarkdown('# 一级标题\n\n## 二级标题\n\n### 三级标题');
    expect(res.html).toContain('<h1');
    expect(res.toc.length).toBe(3);
    expect(res.toc[0]).toMatchObject({ level: 1, text: '一级标题' });
    expect(res.toc[0]!.id).toBeTruthy();
  });

  it('代码块高亮（服务端编译时）', () => {
    const res = compileMarkdown('```js\nconst a = 1;\n```');
    expect(res.html).toContain('class="hljs language-js"');
  });

  it('KaTeX 数学公式', () => {
    const res = compileMarkdown('$x^2 + y^2 = z^2$');
    expect(res.html).toContain('katex');
  });

  it('XSS 消毒：脚本/事件属性被清除，外链加安全属性', () => {
    const res = compileMarkdown(
      '<script>alert(1)</script>\n\n<img src="x" onerror="alert(2)">\n\n[baidu](https://baidu.com)',
    );
    expect(res.html).not.toContain('<script');
    expect(res.html).not.toContain('onerror');
    expect(res.html).toContain('rel="noopener nofollow"');
    expect(res.html).toContain('target="_blank"');
  });

  it('图片懒加载 + 封面提取', () => {
    const res = compileMarkdown('![](https://cdn.example.com/a.png)');
    expect(res.html).toContain('loading="lazy"');
    expect(res.cover).toBe('https://cdn.example.com/a.png');
  });

  it('表格渲染', () => {
    const res = compileMarkdown('| a | b |\n|---|---|\n| 1 | 2 |');
    expect(res.html).toContain('<table>');
  });

  it('字数统计（中文按字 + 英文按词）', () => {
    const res = compileMarkdown('你好世界 hello world');
    expect(res.wordCount).toBeGreaterThanOrEqual(6);
    expect(countWords('你好 世界')).toBe(4);
  });

  it('摘要截断', () => {
    const s = makeSummary('一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十', 20);
    expect(s.endsWith('…')).toBe(true);
    expect(makeSummary('短文本')).toBe('短文本');
  });
});
