import type { Command } from 'commander';
import { getNote, htmlToMarkdown } from '@upnote/core';

export function registerGetCommand(program: Command): void {
  program
    .command('get <noteId>')
    .description('Get full note content')
    .option('--format <fmt>', 'Output format: md, html, json', 'md')
    .action(async (noteId: string, opts: { format: string }) => {
      const note = getNote(noteId);
      if (!note) {
        console.error(`Note not found: ${noteId}`);
        process.exit(1);
      }

      switch (opts.format) {
        case 'html':
          console.log(note.html);
          break;
        case 'json':
          console.log(JSON.stringify(note, null, 2));
          break;
        case 'md':
        default:
          console.log(`# ${note.title}\n`);
          console.log(htmlToMarkdown(note.html));
          break;
      }
    });
}
