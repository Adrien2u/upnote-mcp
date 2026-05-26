import TurndownService from 'turndown';
import { marked } from 'marked';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

// Preserve UpNote checkbox syntax
turndown.addRule('checkbox', {
  filter: (node) => node.nodeName === 'INPUT' && (node as HTMLInputElement).type === 'checkbox',
  replacement: (_content, node) => {
    const checked = (node as HTMLInputElement).checked;
    return checked ? '[x] ' : '[ ] ';
  },
});

export function htmlToMarkdown(html: string): string {
  if (!html) return '';
  return turndown.turndown(html);
}

export async function markdownToHtml(markdown: string): Promise<string> {
  if (!markdown) return '';
  return marked(markdown) as string;
}
