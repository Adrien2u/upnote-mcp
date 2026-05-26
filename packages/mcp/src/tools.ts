import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  listNotebooks,
  listNotes,
  searchNotes,
  getNote,
  listTags,
  getBookmarked,
  listTemplates,
  writeNote,
  findRecentNoteByTitle,
  createNote,
  openNote,
  createNotebook,
  openNotebook,
  searchUi,
  viewTag,
  viewFilter,
  htmlToMarkdown,
  markdownToHtml,
} from '@upnote/core';

export function registerTools(server: McpServer): void {
  // --- READ TOOLS ---

  server.tool(
    'upnote_list_notebooks',
    'List all UpNote notebooks with their note counts and sub-notebook IDs. Works even when UpNote is closed.',
    {},
    async () => {
      const notebooks = listNotebooks();
      return {
        content: [{ type: 'text', text: JSON.stringify(notebooks, null, 2) }],
      };
    }
  );

  server.tool(
    'upnote_list_notes',
    'List notes from UpNote, optionally filtered by notebook ID or tag name. Returns id, title, summary, and timestamps. Note: notes created via upnote_create_note may not appear immediately — UpNote must write them to its local database first (give it a few seconds with focus).',
    {
      notebookId: z.string().optional().describe('Filter by notebook ID'),
      tag: z.string().optional().describe('Filter by tag name'),
      limit: z.number().int().min(1).max(500).optional().default(50).describe('Maximum notes to return'),
      offset: z.number().int().min(0).optional().default(0).describe('Skip first N notes'),
    },
    async (params) => {
      const notes = listNotes(params);
      return {
        content: [{ type: 'text', text: JSON.stringify(notes, null, 2) }],
      };
    }
  );

  server.tool(
    'upnote_search_notes',
    'Search UpNote notes by title or content text. Returns matching note summaries with IDs. Note: queries the local SQLite database — notes created via upnote_create_note may not appear for a few seconds until UpNote flushes them to disk. Existing notes always return immediately.',
    {
      query: z.string().min(1).describe('Search query string'),
      limit: z.number().int().min(1).max(100).optional().default(20).describe('Maximum results'),
    },
    async (params) => {
      const results = searchNotes(params.query, params.limit);
      return {
        content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
      };
    }
  );

  server.tool(
    'upnote_get_note',
    'Get the full content of a specific UpNote note by ID. Returns title and content in Markdown format.',
    {
      noteId: z.string().min(1).describe('The note ID (from list or search)'),
      format: z.enum(['md', 'html', 'json']).optional().default('md').describe('Output format'),
    },
    async (params) => {
      const note = getNote(params.noteId);
      if (!note) {
        return {
          content: [{ type: 'text', text: `Note not found: ${params.noteId}` }],
          isError: true,
        };
      }

      let text: string;
      if (params.format === 'html') {
        text = note.html;
      } else if (params.format === 'json') {
        text = JSON.stringify(note, null, 2);
      } else {
        text = `# ${note.title}\n\n${htmlToMarkdown(note.html)}`;
      }

      return { content: [{ type: 'text', text }] };
    }
  );

  server.tool(
    'upnote_list_tags',
    'List all UpNote tags with their note counts.',
    {},
    async () => {
      const tags = listTags();
      return {
        content: [{ type: 'text', text: JSON.stringify(tags, null, 2) }],
      };
    }
  );

  server.tool(
    'upnote_get_bookmarked',
    'Get all bookmarked or pinned UpNote notes.',
    {},
    async () => {
      const notes = getBookmarked();
      return {
        content: [{ type: 'text', text: JSON.stringify(notes, null, 2) }],
      };
    }
  );

  server.tool(
    'upnote_list_templates',
    'List all UpNote note templates.',
    {},
    async () => {
      const templates = listTemplates();
      return {
        content: [{ type: 'text', text: JSON.stringify(templates, null, 2) }],
      };
    }
  );

  // --- WRITE TOOLS ---

  server.tool(
    'upnote_create_note',
    'Create a new note in UpNote with optional Markdown content. If markdownContent is provided, the note is created via URL scheme then the Markdown is converted to rich HTML and written directly to the database — returns the note ID so you can reference it immediately. Requires UpNote to be running.',
    {
      title: z.string().min(1).describe('Note title'),
      markdownContent: z.string().optional().describe('Note body in Markdown format. Will be rendered as rich text in UpNote.'),
      newWindow: z.boolean().optional().default(false).describe('Open in a new UpNote window'),
    },
    async (params) => {
      if (!params.markdownContent) {
        createNote({ title: params.title, newWindow: params.newWindow });
        return {
          content: [{ type: 'text', text: `Created note "${params.title}" in UpNote.` }],
        };
      }

      // With content: create via URL scheme (registers the note in UpNote's memory
      // model), then poll SQLite until the note appears and immediately overwrite
      // with our HTML — before UpNote's background Firebase sync can upload the
      // plain-text version. UpNote sees synced=0 and re-uploads our HTML.
      const newHtml = await markdownToHtml(params.markdownContent);
      const fullHtml = `<h2>${params.title}</h2>\n${newHtml}`;
      const plainText = params.markdownContent.replace(/[#*_`~>\-[\]]/g, ' ').replace(/\s+/g, ' ').trim();
      const summary = plainText.substring(0, 150) || null;

      const since = Date.now();
      createNote({ title: params.title, newWindow: params.newWindow });

      // Poll until UpNote writes the note to SQLite (typically < 500 ms)
      let noteId: string | null = null;
      const deadline = since + 8000;
      while (Date.now() < deadline) {
        await new Promise<void>((r) => setTimeout(r, 150));
        noteId = findRecentNoteByTitle(params.title, since - 1000);
        if (noteId) break;
      }

      if (!noteId) {
        return {
          content: [{ type: 'text', text: `Created note "${params.title}" in UpNote (title only — Markdown formatting could not be applied: note did not appear in database within 8 s). Is UpNote running?` }],
        };
      }

      writeNote(noteId, { html: fullHtml, text: plainText, title: params.title, summary });
      openNote({ noteId });

      return {
        content: [{ type: 'text', text: `Created note "${params.title}" with Markdown content. Note ID: ${noteId}` }],
      };
    }
  );

  server.tool(
    'upnote_move_to_trash',
    'Move a note to the UpNote trash.',
    {
      noteId: z.string().min(1).describe('Note ID to move to trash'),
    },
    async (params) => {
      const { execSync } = await import('child_process');
      const url = `upnote://x-callback-url/note/moveToTrash?noteId=${encodeURIComponent(params.noteId)}`;
      const escaped = url.replace(/'/g, "''");
      execSync(`powershell -Command "Start-Process '${escaped}'"`, { stdio: 'ignore' });
      return { content: [{ type: 'text', text: `Moved note ${params.noteId} to trash.` }] };
    }
  );

  server.tool(
    'upnote_edit_note',
    'Edit an existing UpNote note in-place (experimental: writes to SQLite, sets synced=0, UpNote syncs on focus). Use safe=true to create a replacement note instead.',
    {
      noteId: z.string().min(1).describe('Note ID to edit'),
      markdownContent: z.string().min(1).describe('New note content in Markdown'),
      safe: z.boolean().optional().default(false).describe('If true, creates a new note instead of editing in-place'),
    },
    async (params) => {
      const existing = getNote(params.noteId);
      if (!existing) {
        return {
          content: [{ type: 'text', text: `Note not found: ${params.noteId}` }],
          isError: true,
        };
      }

      const newHtml = await markdownToHtml(params.markdownContent);
      const fullHtml = `<h2>${existing.title}</h2>\n${newHtml}`;
      const plainText = params.markdownContent.replace(/[#*_`~>\-[\]]/g, ' ').replace(/\s+/g, ' ').trim();
      const summary = plainText.substring(0, 150) || null;

      if (params.safe) {
        // URL scheme only supports plain text in v1101+ — must use polling approach
        const since = Date.now();
        createNote({ title: existing.title, newWindow: false });

        let noteId: string | null = null;
        const deadline = since + 8000;
        while (Date.now() < deadline) {
          await new Promise<void>((r) => setTimeout(r, 150));
          noteId = findRecentNoteByTitle(existing.title, since - 1000);
          if (noteId) break;
        }

        if (!noteId) {
          return {
            content: [{ type: 'text', text: `Created replacement note "${existing.title}" (title only — Markdown not applied: note not found in DB within 8s). Original (${params.noteId}) preserved.` }],
          };
        }

        writeNote(noteId, { html: fullHtml, text: plainText, title: existing.title, summary });
        openNote({ noteId });

        return {
          content: [{ type: 'text', text: `Created replacement note "${existing.title}" with Markdown content. Note ID: ${noteId}. Original (${params.noteId}) preserved.` }],
        };
      }

      writeNote(params.noteId, { html: fullHtml, text: plainText, title: existing.title, summary });
      openNote({ noteId: params.noteId });

      return {
        content: [{ type: 'text', text: `Updated note "${existing.title}". UpNote will sync changes on focus.` }],
      };
    }
  );

  server.tool(
    'upnote_open_note',
    'Open a specific note in the UpNote desktop app.',
    {
      noteId: z.string().min(1).describe('Note ID to open'),
      newWindow: z.boolean().optional().default(false),
    },
    async (params) => {
      openNote(params);
      return { content: [{ type: 'text', text: `Opening note ${params.noteId} in UpNote.` }] };
    }
  );

  server.tool(
    'upnote_create_notebook',
    'Create a new notebook in UpNote.',
    {
      title: z.string().min(1).describe('Notebook title'),
    },
    async (params) => {
      createNotebook(params.title);
      return { content: [{ type: 'text', text: `Created notebook "${params.title}" in UpNote.` }] };
    }
  );

  server.tool(
    'upnote_open_notebook',
    'Open a notebook in the UpNote desktop app.',
    {
      notebookId: z.string().min(1).describe('Notebook ID to open'),
    },
    async (params) => {
      openNotebook(params.notebookId);
      return { content: [{ type: 'text', text: `Opening notebook ${params.notebookId} in UpNote.` }] };
    }
  );

  server.tool(
    'upnote_search_ui',
    'Open UpNote and trigger a search query in the UI. Note: the search URL scheme was removed in UpNote v1101; this may open UpNote without the query pre-filled.',
    {
      query: z.string().min(1).describe('Search query'),
    },
    async (params) => {
      searchUi(params.query);
      return { content: [{ type: 'text', text: `Searching UpNote for "${params.query}".` }] };
    }
  );

  server.tool(
    'upnote_view_tag',
    'Open a tag view in UpNote to show all notes with that tag.',
    {
      tagName: z.string().min(1).describe('Tag name to view'),
    },
    async (params) => {
      viewTag(params.tagName);
      return { content: [{ type: 'text', text: `Opening tag "${params.tagName}" in UpNote.` }] };
    }
  );

  server.tool(
    'upnote_view_filter',
    'Open a saved filter in UpNote (e.g., "today", "week", "month").',
    {
      filterId: z.string().min(1).describe('Filter ID to open'),
    },
    async (params) => {
      viewFilter(params.filterId);
      return { content: [{ type: 'text', text: `Opening filter "${params.filterId}" in UpNote.` }] };
    }
  );
}
