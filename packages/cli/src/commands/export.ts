import type { Command } from 'commander';
import { listNotes, getNote, htmlToMarkdown } from '@upnote/core';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export function registerExportCommand(program: Command): void {
  program
    .command('export')
    .description('Export all notes to files')
    .option('--format <fmt>', 'Export format: md or json', 'md')
    .option('--out <dir>', 'Output directory', './upnote-export')
    .option('--notebook <id>', 'Export only from a specific notebook')
    .action(async (opts: { format: string; out: string; notebook?: string }) => {
      const notes = listNotes({ notebookId: opts.notebook, limit: 10000 });
      mkdirSync(opts.out, { recursive: true });

      let exported = 0;
      for (const summary of notes) {
        const note = getNote(summary.id);
        if (!note) continue;

        const safeName = (note.title || summary.id).replace(/[<>:"/\\|?*]/g, '_').substring(0, 100);
        const filename = `${safeName}_${summary.id.substring(0, 8)}`;

        if (opts.format === 'json') {
          writeFileSync(join(opts.out, `${filename}.json`), JSON.stringify(note, null, 2));
        } else {
          const md = `# ${note.title}\n\n${htmlToMarkdown(note.html)}`;
          writeFileSync(join(opts.out, `${filename}.md`), md);
        }
        exported++;
      }

      console.log(`Exported ${exported} notes to ${opts.out}`);
    });
}
