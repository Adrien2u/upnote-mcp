import type { Command } from 'commander';
import { createNote } from '@upnote/core';

export function registerNewCommand(program: Command): void {
  program
    .command('new')
    .description('Create a new note in UpNote')
    .requiredOption('--title <title>', 'Note title')
    .option('--notebook <id>', 'Target notebook ID')
    .option('--content <markdown>', 'Note content in Markdown')
    .option('--new-window', 'Open note in a new window')
    .action((opts: { title: string; notebook?: string; content?: string; newWindow?: boolean }) => {
      createNote({
        title: opts.title,
        markdownContent: opts.content,
        notebookId: opts.notebook,
        newWindow: opts.newWindow,
      });
      console.log(`Created note "${opts.title}" in UpNote.`);
    });
}
