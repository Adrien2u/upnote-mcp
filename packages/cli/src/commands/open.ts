import type { Command } from 'commander';
import { openNote, openNotebook, searchUi } from '@upnote/core';

export function registerOpenCommand(program: Command): void {
  const open = program.command('open').description('Open items in UpNote');

  open
    .command('note <noteId>')
    .description('Open a note in UpNote')
    .option('--new-window', 'Open in a new window')
    .action((noteId: string, opts: { newWindow?: boolean }) => {
      openNote({ noteId, newWindow: opts.newWindow });
      console.log(`Opening note ${noteId} in UpNote.`);
    });

  open
    .command('notebook <notebookId>')
    .description('Open a notebook in UpNote')
    .action((notebookId: string) => {
      openNotebook(notebookId);
      console.log(`Opening notebook ${notebookId} in UpNote.`);
    });

  open
    .command('search <query>')
    .description('Open UpNote with search results')
    .action((query: string) => {
      searchUi(query);
      console.log(`Searching UpNote for "${query}".`);
    });
}
