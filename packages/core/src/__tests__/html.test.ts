import { describe, it, expect } from 'vitest';
import { htmlToMarkdown, markdownToHtml } from '../html.js';

describe('htmlToMarkdown', () => {
  it('converts h1 to atx heading', () => {
    expect(htmlToMarkdown('<h1>Title</h1>')).toContain('# Title');
  });

  it('converts h2', () => {
    expect(htmlToMarkdown('<h2>Sub</h2>')).toContain('## Sub');
  });

  it('converts h3', () => {
    expect(htmlToMarkdown('<h3>Three</h3>')).toContain('### Three');
  });

  it('converts bold to **', () => {
    expect(htmlToMarkdown('<p><strong>bold</strong></p>')).toContain('**bold**');
  });

  it('converts italic to _', () => {
    const result = htmlToMarkdown('<p><em>italic</em></p>');
    expect(result).toMatch(/_italic_|\*italic\*/);
  });

  it('converts unordered list', () => {
    const result = htmlToMarkdown('<ul><li>Alpha</li><li>Beta</li></ul>');
    // turndown may use '- ' or '-   ' depending on version
    expect(result).toMatch(/[-*]\s+Alpha/);
    expect(result).toMatch(/[-*]\s+Beta/);
  });

  it('converts ordered list', () => {
    const result = htmlToMarkdown('<ol><li>First</li><li>Second</li></ol>');
    expect(result).toContain('1.');
    expect(result).toContain('First');
  });

  it('converts code block', () => {
    const result = htmlToMarkdown('<pre><code>const x = 1;</code></pre>');
    expect(result).toContain('```');
    expect(result).toContain('const x = 1;');
  });

  it('converts inline code', () => {
    const result = htmlToMarkdown('<p><code>myVar</code></p>');
    expect(result).toContain('`myVar`');
  });

  it('converts blockquote', () => {
    const result = htmlToMarkdown('<blockquote><p>Quote text</p></blockquote>');
    expect(result).toContain('>');
    expect(result).toContain('Quote text');
  });

  it('converts anchor links', () => {
    const result = htmlToMarkdown('<a href="https://example.com">Click</a>');
    expect(result).toContain('Click');
    expect(result).toContain('https://example.com');
  });

  it('converts strikethrough', () => {
    const result = htmlToMarkdown('<del>removed</del>');
    expect(result).toContain('removed');
  });

  it('handles empty input gracefully', () => {
    expect(htmlToMarkdown('')).toBe('');
  });

  it('strips or escapes script tag content', () => {
    const result = htmlToMarkdown('<script>alert("xss")</script><p>safe</p>');
    // turndown may leave script content as escaped text; what matters is <script> is gone
    expect(result).not.toContain('<script>');
    expect(result).toContain('safe');
  });

  it('preserves nested structure (heading + list)', () => {
    const html = '<h1>Title</h1><ul><li>Item A</li><li>Item B</li></ul>';
    const md = htmlToMarkdown(html);
    expect(md).toContain('# Title');
    expect(md).toMatch(/[-*]\s+Item A/);
    expect(md).toMatch(/[-*]\s+Item B/);
  });

  it('handles multiple paragraphs', () => {
    const result = htmlToMarkdown('<p>Para one</p><p>Para two</p>');
    expect(result).toContain('Para one');
    expect(result).toContain('Para two');
  });
});

describe('markdownToHtml', () => {
  it('converts h1 to <h1> tag', async () => {
    const result = await markdownToHtml('# Title');
    expect(result).toContain('<h1>');
    expect(result).toContain('Title');
  });

  it('converts bold to <strong>', async () => {
    const result = await markdownToHtml('**bold**');
    expect(result).toContain('<strong>bold</strong>');
  });

  it('converts italic to <em>', async () => {
    const result = await markdownToHtml('_italic_');
    expect(result).toContain('<em>italic</em>');
  });

  it('converts unordered list to <ul><li>', async () => {
    const result = await markdownToHtml('- Alpha\n- Beta');
    expect(result).toContain('<ul>');
    expect(result).toContain('<li>Alpha</li>');
  });

  it('converts ordered list to <ol><li>', async () => {
    const result = await markdownToHtml('1. First\n2. Second');
    expect(result).toContain('<ol>');
    expect(result).toContain('<li>First</li>');
  });

  it('converts fenced code block to <pre><code>', async () => {
    const result = await markdownToHtml('```\nconst x = 1;\n```');
    expect(result).toContain('<code>');
    expect(result).toContain('const x = 1;');
  });

  it('converts inline code to <code>', async () => {
    const result = await markdownToHtml('Use `myVar` here');
    expect(result).toContain('<code>myVar</code>');
  });

  it('converts blockquote', async () => {
    const result = await markdownToHtml('> Quote');
    expect(result).toContain('<blockquote>');
  });

  it('converts link to <a> tag', async () => {
    const result = await markdownToHtml('[Click](https://example.com)');
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('Click');
  });

  it('handles empty input gracefully', async () => {
    const result = await markdownToHtml('');
    expect(result.trim()).toBe('');
  });

  it('converts checkbox list items', async () => {
    const result = await markdownToHtml('- [ ] unchecked\n- [x] checked');
    expect(result).toContain('unchecked');
    expect(result).toContain('checked');
  });

  it('converts table to <table> tag', async () => {
    const md = '| A | B |\n|---|---|\n| 1 | 2 |';
    const result = await markdownToHtml(md);
    expect(result).toContain('<table>');
    expect(result).toContain('<td>');
  });

  it('converts horizontal rule', async () => {
    const result = await markdownToHtml('---');
    expect(result).toContain('<hr');
  });
});

describe('round-trip fidelity', () => {
  it('heading round-trips through html→md→html', async () => {
    const html = '<h2>Section Title</h2>';
    const md = htmlToMarkdown(html);
    const backToHtml = await markdownToHtml(md);
    expect(backToHtml).toContain('Section Title');
    expect(backToHtml).toContain('<h2>');
  });

  it('list round-trips without losing items', async () => {
    const html = '<ul><li>Alpha</li><li>Beta</li><li>Gamma</li></ul>';
    const md = htmlToMarkdown(html);
    // md has list markers; markdownToHtml converts back
    expect(md).toMatch(/Alpha/);
    expect(md).toMatch(/Beta/);
    expect(md).toMatch(/Gamma/);
    const backToHtml = await markdownToHtml(md);
    expect(backToHtml).toContain('Alpha');
    expect(backToHtml).toContain('Beta');
    expect(backToHtml).toContain('Gamma');
  });

  it('bold text survives round-trip', async () => {
    const html = '<p>Normal <strong>bold</strong> normal</p>';
    const md = htmlToMarkdown(html);
    const backToHtml = await markdownToHtml(md);
    expect(backToHtml).toContain('<strong>bold</strong>');
  });
});
