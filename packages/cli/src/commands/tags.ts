import type { Command } from 'commander';
import { listTags, viewTag } from '@upnote/core';

export function registerTagsCommand(program: Command): void {
  const tags = program.command('tags').description('Manage tags');

  tags
    .command('list')
    .description('List all tags with note counts')
    .option('--json', 'Output as JSON')
    .action((opts: { json?: boolean }) => {
      const allTags = listTags();
      if (opts.json) {
        console.log(JSON.stringify(allTags, null, 2));
        return;
      }
      if (allTags.length === 0) {
        console.log('No tags found.');
        return;
      }
      console.log(`\nTags (${allTags.length}):\n`);
      for (const t of allTags) {
        console.log(`  ${t.title.padEnd(40)} ${String(t.noteCount).padStart(4)} notes  id:${t.id}`);
      }
    });

  tags
    .command('open <tagName>')
    .description('Open a tag in UpNote')
    .action((tagName: string) => {
      viewTag(tagName);
      console.log(`Opening tag "${tagName}" in UpNote.`);
    });

  // shortcut: 'upnote tags' with no subcommand lists all tags
  tags.action((opts: { json?: boolean }) => {
    const allTags = listTags();
    if (allTags.length === 0) {
      console.log('No tags found.');
      return;
    }
    console.log(`\nTags (${allTags.length}):\n`);
    for (const t of allTags) {
      console.log(`  ${t.title.padEnd(40)} ${String(t.noteCount).padStart(4)} notes  id:${t.id}`);
    }
  });
}
