import type { Command } from 'commander';
import { listNotebooks, listNotes } from '@upnote/core';

export function registerListCommand(program: Command): void {
  const list = program.command('list').description('List notebooks or notes');

  list
    .command('notebooks')
    .description('List all notebooks')
    .option('--json', 'Output as JSON')
    .action((opts: { json?: boolean }) => {
      const notebooks = listNotebooks();
      if (opts.json) {
        console.log(JSON.stringify(notebooks, null, 2));
        return;
      }
      if (notebooks.length === 0) {
        console.log('No notebooks found.');
        return;
      }
      console.log(`\nNotebooks (${notebooks.length}):\n`);
      for (const nb of notebooks) {
        const children = nb.childNotebooks.length > 0 ? ` [${nb.childNotebooks.length} sub-notebooks]` : '';
        console.log(`  ${nb.title.padEnd(40)} ${String(nb.noteCount).padStart(4)} notes  id:${nb.id}${children}`);
      }
    });

  list
    .command('notes')
    .description('List notes, optionally filtered by notebook or tag')
    .option('--notebook <id>', 'Filter by notebook ID')
    .option('--tag <name>', 'Filter by tag name')
    .option('--limit <n>', 'Maximum results', '50')
    .option('--offset <n>', 'Skip first N results', '0')
    .option('--json', 'Output as JSON')
    .action((opts: { notebook?: string; tag?: string; limit: string; offset: string; json?: boolean }) => {
      const notes = listNotes({
        notebookId: opts.notebook,
        tag: opts.tag,
        limit: parseInt(opts.limit),
        offset: parseInt(opts.offset),
      });
      if (opts.json) {
        console.log(JSON.stringify(notes, null, 2));
        return;
      }
      if (notes.length === 0) {
        console.log('No notes found.');
        return;
      }
      console.log(`\nNotes (${notes.length}):\n`);
      for (const n of notes) {
        const flags = [n.pinned ? '📌' : '', n.bookmarked ? '⭐' : '', n.isTemplate ? '📄' : ''].filter(Boolean).join('');
        const date = new Date(n.updatedAt).toLocaleDateString();
        console.log(`  ${(n.title || '(untitled)').substring(0, 40).padEnd(42)} ${date}  id:${n.id} ${flags}`);
      }
    });
}
