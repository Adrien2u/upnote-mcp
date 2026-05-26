import type { Command } from 'commander';
import { getNote, writeNote, createNote, openNote, htmlToMarkdown, markdownToHtml } from '@upnote/core';

export function registerEditCommand(program: Command): void {
  program
    .command('edit <noteId>')
    .description('Edit a note (experimental: writes to SQLite with synced=0; use --safe for replace mode)')
    .requiredOption('--content <markdown>', 'New note content in Markdown')
    .option('--safe', 'Safe mode: create replacement note instead of editing in-place')
    .action(async (noteId: string, opts: { content: string; safe?: boolean }) => {
      const existing = getNote(noteId);
      if (!existing) {
        console.error(`Note not found: ${noteId}`);
        process.exit(1);
      }

      if (opts.safe) {
        // Option B: create a replacement note
        createNote({
          title: existing.title,
          markdownContent: opts.content,
        });
        console.log(`Created replacement note "${existing.title}" in UpNote.`);
        console.log(`Original note (id: ${noteId}) preserved — delete manually if desired.`);
        return;
      }

      // Option A: direct SQLite write with synced=0
      console.warn('Warning: experimental in-place edit — UpNote will sync changes on next focus.');

      const newHtml = await markdownToHtml(opts.content);
      const plainText = opts.content.replace(/<[^>]+>/g, '');

      // Generate summary from first 150 chars of text
      const summary = opts.content.replace(/#+\s/g, '').substring(0, 150).trim() || null;

      writeNote(noteId, {
        html: newHtml,
        text: plainText,
        title: existing.title,
        summary,
      });

      console.log(`Updated note "${existing.title}" (id: ${noteId}).`);
      console.log('Opening note in UpNote to trigger sync...');
      openNote({ noteId });
    });
}
