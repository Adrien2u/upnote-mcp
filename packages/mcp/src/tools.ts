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
    'Create a new note in UpNote. Accepts full Markdown for content (headers, lists, code, tables, checkboxes). Requires UpNote to be running or installed. The note is created asynchronously — wait a few seconds before using upnote_search_notes or upnote_list_notes to find it.',
    {
      title: z.string().min(1).describe('Note title'),
      markdownContent: z.string().optional().describe('Note body in Markdown format'),
      notebookId: z.string().optional().describe('Target notebook ID (from upnote_list_notebooks)'),
      newWindow: z.boolean().optional().default(false).describe('Open in a new UpNote window'),
    },
    async (params) => {
      createNote(params);
      return {
        content: [{ type: 'text', text: `Created note "${params.title}" in UpNote.` }],
      };
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

      if (params.safe) {
        createNote({ title: existing.title, markdownContent: params.markdownContent });
        return {
          content: [{ type: 'text', text: `Created replacement note "${existing.title}". Original (${params.noteId}) preserved.` }],
        };
      }

      const newHtml = await markdownToHtml(params.markdownContent);
      const plainText = params.markdownContent.replace(/#+\s/g, '');
      const summary = params.markdownContent.replace(/#+\s/g, '').substring(0, 150).trim() || null;

      writeNote(params.noteId, { html: newHtml, text: plainText, title: existing.title, summary });
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
    'Open UpNote with a search query (navigates UpNote UI to show search results).',
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
