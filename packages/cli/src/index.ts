#!/usr/bin/env node
import { Command } from 'commander';
import { registerListCommand } from './commands/list.js';
import { registerSearchCommand } from './commands/search.js';
import { registerGetCommand } from './commands/get.js';
import { registerNewCommand } from './commands/new.js';
import { registerEditCommand } from './commands/edit.js';
import { registerOpenCommand } from './commands/open.js';
import { registerTagsCommand } from './commands/tags.js';
import { registerExportCommand } from './commands/export.js';

const program = new Command();

program
  .name('upnote')
  .description('CLI for UpNote — read, search, create, and edit notes')
  .version('0.1.0');

registerListCommand(program);
registerSearchCommand(program);
registerGetCommand(program);
registerNewCommand(program);
registerEditCommand(program);
registerOpenCommand(program);
registerTagsCommand(program);
registerExportCommand(program);

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error('Error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
