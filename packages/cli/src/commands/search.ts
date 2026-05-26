import type { Command } from 'commander';
import { searchNotes } from '@upnote/core';

export function registerSearchCommand(program: Command): void {
  program
    .command('search <query>')
    .description('Search notes by title or content')
    .option('--limit <n>', 'Maximum results', '20')
    .option('--json', 'Output as JSON')
    .action((query: string, opts: { limit: string; json?: boolean }) => {
      const results = searchNotes(query, parseInt(opts.limit));
      if (opts.json) {
        console.log(JSON.stringify(results, null, 2));
        return;
      }
      if (results.length === 0) {
        console.log(`No notes matching "${query}".`);
        return;
      }
      console.log(`\nSearch results for "${query}" (${results.length}):\n`);
      for (const n of results) {
        const date = new Date(n.updatedAt).toLocaleDateString();
        const summary = n.summary ? `  ${n.summary.substring(0, 60)}...` : '';
        console.log(`  ${(n.title || '(untitled)').substring(0, 40).padEnd(42)} ${date}  id:${n.id}`);
        if (summary) console.log(`    ${summary}`);
      }
    });
}
