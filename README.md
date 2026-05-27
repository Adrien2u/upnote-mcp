# upnote-mcp

> Unofficial CLI and MCP server for [UpNote](https://getupnote.com) — read, search, create, and edit notes from the terminal or Claude.

[![Tests](https://img.shields.io/badge/tests-141%20passing-brightgreen)](#testing)
[![Node](https://img.shields.io/badge/node-%3E%3D18-blue)](https://nodejs.org)
[![Platform](https://img.shields.io/badge/platform-Windows-blue)](#requirements)
[![MCP](https://img.shields.io/badge/MCP-compatible-purple)](https://modelcontextprotocol.io)

UpNote has no official API. This project reverse-engineers the local SQLite database for reads and uses UpNote's [x-callback-url scheme](https://help.getupnote.com/resources/x-callback-url-endpoints) for writes — giving you a fully functional interface without touching the sync layer.

---

## Table of Contents

- [How It Works](#how-it-works)
- [Requirements](#requirements)
- [Installation](#installation)
- [MCP Server Setup](#mcp-server-setup)
- [CLI Usage](#cli-usage)
- [MCP Tools Reference](#mcp-tools-reference)
- [Note Editing](#note-editing)
- [Formatting Support](#formatting-support)
- [Architecture](#architecture)
- [Development](#development)
- [Testing](#testing)
- [Limitations & Known Issues](#limitations--known-issues)
- [License](#license)

---

## How It Works

| Operation | Method | UpNote Required? |
|-----------|--------|-----------------|
| Read notes, notebooks, tags | Direct SQLite query (temp copy, read-only) | No |
| Create note (title only) | `upnote://x-callback-url/note/new` via PowerShell | Yes (auto-launched) |
| Create note (with Markdown) | URL scheme → wait for Firebase sync → SQLite write → re-sync | Yes + internet |
| Edit note | SQLite write with `synced=0` → UpNote syncs on focus | Yes (to sync) |
| Open note / navigate | `upnote://x-callback-url/...` | Yes |

**Read operations work even when UpNote is closed.** The database is copied to a temp file before each query so there is no lock contention with the running app.

### Why create-with-content takes a few seconds

UpNote's x-callback-url scheme does not accept HTML or rich Markdown — only plain text. To produce a properly formatted note, this tool uses a two-phase write strategy:

1. **URL scheme** — creates the note in UpNote's memory with the title. UpNote writes it to SQLite (`synced=0`) and immediately uploads the title-only version to Firebase, marking it `synced=1`.
2. **SQLite write** — once `synced=1` is detected (typically 1–3 s), the tool writes the converted HTML to SQLite (`synced=0`). This triggers UpNote's *update* sync path, which reads from SQLite rather than memory, so the full rich content is what gets uploaded to Firebase.
3. **Open** — `openNote` is called to bring the note into focus; UpNote picks up the `synced=0` flag and syncs the HTML version.

Writing *before* the initial Firebase sync completes causes a race condition where UpNote's in-memory title-only state wins. Waiting for `synced=1` first eliminates that race reliably.

---

## Requirements

- **Windows** (uses PowerShell `Start-Process` for URL scheme execution)
- **Node.js 18+**
- **UpNote** installed and launched at least once (creates the local database)
- **pnpm** (installed automatically if missing — see below)

> macOS/Linux support is not included but the read path and MCP server would work with a small change to `packages/core/src/writer.ts` (swap `Start-Process` for `open`).

---

## Installation

```powershell
# Clone
git clone https://github.com/YOUR_USERNAME/upnote-mcp.git
cd upnote-mcp

# Install pnpm if needed
npm install -g pnpm

# Install dependencies (compiles better-sqlite3 from source — requires VS Build Tools)
pnpm install

# Build all packages
pnpm build
```

> **Note on `better-sqlite3`**: The native module compiles during `pnpm install`. This requires [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022) and Python to be installed. Both are typically present on developer machines.

---

## MCP Server Setup

### MCP Router / Claude Desktop

Add the following to your MCP server configuration:

```json
{
  "upnote": {
    "command": "node",
    "args": ["C:\\path\\to\\upnote-mcp\\packages\\mcp\\dist\\index.js"],
    "transport": "stdio",
    "env": {}
  }
}
```

Replace `C:\\path\\to\\upnote-mcp` with the actual path where you cloned the repo.

### Claude Code (`.claude/settings.json`)

```json
{
  "mcpServers": {
    "upnote": {
      "command": "node",
      "args": ["C:\\path\\to\\upnote-mcp\\packages\\mcp\\dist\\index.js"],
      "transport": "stdio"
    }
  }
}
```

Once connected, Claude can list your notebooks, search notes, read content, and create new notes directly.

---

## CLI Usage

The CLI is at `packages/cli/dist/index.js`. To use it as `upnote` globally:

```powershell
npm link --workspace packages/cli
```

Or invoke directly:

```powershell
node packages/cli/dist/index.js <command>
```

### Commands

#### List notebooks

```powershell
upnote list notebooks
upnote list notebooks --json
```

```
Notebooks (3):

  Personal Notes                               12 notes  id:a1b2c3d4-...
  Work Projects                                 7 notes  id:e5f6a7b8-...
  Archive                                       0 notes  id:c9d0e1f2-...
```

#### List notes

```powershell
upnote list notes
upnote list notes --notebook <notebookId>
upnote list notes --tag work
upnote list notes --limit 10 --offset 20
upnote list notes --json
```

#### Search

```powershell
upnote search "quarterly review"
upnote search "meeting" --limit 5
upnote search "roadmap" --json
```

#### Get note content

```powershell
upnote get <noteId>                     # Markdown (default)
upnote get <noteId> --format html       # Raw HTML
upnote get <noteId> --format json       # Full note object
```

#### Create a note

```powershell
upnote new --title "Meeting Notes"
upnote new --title "Shopping List" --content "- Milk\n- Eggs\n- Bread"
upnote new --title "Quick Note" --new-window
```

Content accepts full Markdown — see [Formatting Support](#formatting-support).

> **Note:** The `--notebook` option was removed in UpNote v1101 and is no longer supported by the URL scheme.

#### Edit a note

```powershell
# Experimental in-place edit (recommended)
upnote edit <noteId> --content "## Updated\n\nNew content here."

# Safe mode: creates a replacement note, original is preserved
upnote edit <noteId> --content "New content" --safe
```

#### Open in UpNote

```powershell
upnote open note <noteId>
upnote open notebook <notebookId>
upnote open search "project alpha"
```

#### Tags

```powershell
upnote tags                  # List all tags with counts
upnote tags list --json
upnote tags open "work"      # Open tag view in UpNote
```

#### Export

```powershell
upnote export                                  # All notes as Markdown → ./upnote-export/
upnote export --format json --out ./backup
upnote export --notebook <notebookId> --out ./work-notes
```

---

## MCP Tools Reference

The MCP server exposes **18 tools**. Read tools work without UpNote running; write tools launch UpNote automatically if needed.

### Read Tools (SQLite)

| Tool | Description | Parameters |
|------|-------------|------------|
| `upnote_list_notebooks` | All notebooks with note counts and sub-notebook IDs | — |
| `upnote_list_notes` | Notes, optionally filtered | `notebookId?`, `tag?`, `limit?`, `offset?` |
| `upnote_search_notes` | Full-text search over title and body | `query`, `limit?` |
| `upnote_get_note` | Full note content | `noteId`, `format?` (`md`/`html`/`json`) |
| `upnote_list_tags` | All tags with note counts | — |
| `upnote_get_bookmarked` | All pinned or bookmarked notes | — |
| `upnote_list_templates` | All note templates | — |

### Write Tools (x-callback-url + SQLite)

| Tool | Description | Parameters |
|------|-------------|------------|
| `upnote_create_note` | Create a new note with full Markdown content and optional notebook assignment | `title`, `markdownContent?`, `notebookId?`, `newWindow?` |
| `upnote_edit_note` | Edit note in-place or create replacement | `noteId`, `markdownContent`, `safe?` |
| `upnote_move_to_trash` | Move a note to the UpNote trash | `noteId` |
| `upnote_move_note` | Move a note to a different notebook | `noteId`, `notebookId` |
| `upnote_delete_note` | Permanently delete a trashed note (must be in trash first) | `noteId` |
| `upnote_open_note` | Open a note in UpNote | `noteId`, `newWindow?` |
| `upnote_create_notebook` | Create a new notebook | `title` |
| `upnote_open_notebook` | Open a notebook in UpNote | `notebookId` |
| `upnote_search_ui` | Open UpNote search for a query | `query` |
| `upnote_view_tag` | Open a tag view in UpNote | `tagName` |
| `upnote_view_filter` | Open a saved filter (today, week, etc.) | `filterId` |

### Example Claude prompts

Once the MCP server is connected:

> *"List my UpNote notebooks"*
> *"Search my notes for anything about the Q3 roadmap"*
> *"Get the content of note [id]"*
> *"Create a new note called 'Weekly Review' with a checklist of 5 items"*
> *"What are my bookmarked notes?"*

---

## Note Editing

UpNote provides no edit endpoint via x-callback-url. This project uses two strategies:

### Option A — In-place SQLite write (default)

```powershell
upnote edit <noteId> --content "## New Content\n\nUpdated text."
```

Converts the Markdown to HTML, writes it directly to `upnote.sqlite3` with `synced=0`, then opens the note in UpNote. UpNote detects `synced=0`, reads the updated HTML from SQLite, and uploads it to Firebase.

Fields updated: `html`, `text`, `title`, `summary`, `updatedAt`  
Fields never touched: `id`, `revision`, `space`, `createdAt`, `deleted`

> ⚠️ **Risk**: If UpNote is actively writing to the database at the same moment, a WAL conflict could occur. The implementation retries once after 500ms. Use `--safe` if you need a guaranteed zero-risk path.

### Option B — Replace note (safe mode)

```powershell
upnote edit <noteId> --content "New content" --safe
```

Creates a new note with the same title and updated Markdown content using the same two-phase sync strategy as `upnote_create_note`. The original is left intact — delete it manually in UpNote if desired.

---

## Formatting Support

Note creation and editing (`--content` / `markdownContent` parameter) accepts full Markdown, which is converted to UpNote's internal rich-text HTML format:

| Feature | Syntax |
|---------|--------|
| Headings | `# H1` through `###### H6` |
| Bold | `**bold**` |
| Italic | `_italic_` |
| Strikethrough | `~~removed~~` |
| Inline code | `` `code` `` |
| Code block | ` ```language ` |
| Unordered list | `- item` |
| Ordered list | `1. item` |
| Nested list | Indent with 2 spaces |
| Checkbox (to-do) | `- [ ] unchecked` / `- [x] checked` |
| Blockquote | `> quote` |
| Table | `\| Col \| Col \|` with separator row |
| Horizontal rule | `---` |
| Link | `[text](url)` |

> Image embedding is not supported via x-callback-url — images require a separate upload step that UpNote does not expose publicly.

---

## Architecture

```
upnote-mcp/
├── packages/
│   ├── core/          # Shared library: SQLite queries, URL builder, HTML↔MD
│   ├── cli/           # Terminal interface (commander.js)
│   └── mcp/           # MCP server (stdio transport, 16 tools)
```

```
Read path:   CLI / MCP  →  @upnote/core  →  temp copy of upnote.sqlite3 (read-only)
Write path:  CLI / MCP  →  @upnote/core  →  upnote:// URL  →  UpNote app  →  Firebase
Edit path:   CLI / MCP  →  @upnote/core  →  upnote.sqlite3 (guarded write, synced=0)  →  UpNote syncs on focus
```

**Database location:** `%APPDATA%\Roaming\UpNote\upnote.sqlite3`

**Schema version:** The database `dataVersion` is checked on startup (currently `16`). If UpNote updates and changes the schema, the tool will fail with a clear error rather than silently returning wrong data.

---

## Development

```powershell
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Watch mode (rebuilds on save)
cd packages/core && npx tsup src/index.ts --format esm --dts --watch

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch
```

### Project structure

```
packages/core/src/
  db.ts       — SQLite read queries + guarded write + insert
  html.ts     — HTML → Markdown (turndown) and Markdown → HTML (marked)
  paths.ts    — Database path resolution + schema version guard
  types.ts    — TypeScript interfaces for Note, Notebook, Tag, Filter
  writer.ts   — x-callback-url builder + PowerShell executor

packages/cli/src/commands/
  list.ts     — list notebooks / list notes
  search.ts   — full-text search
  get.ts      — get note content
  new.ts      — create note
  edit.ts     — edit note (in-place or safe)
  open.ts     — open note / notebook / search in UpNote
  tags.ts     — list tags, open tag view
  export.ts   — bulk export to Markdown or JSON

packages/mcp/src/
  index.ts    — MCP server setup + stdio transport
  tools.ts    — 18 tool definitions with Zod input schemas
```

---

## Testing

```powershell
pnpm test
```

**141 tests, 4 test files:**

| File | Tests | What it covers |
|------|-------|----------------|
| `db.test.ts` | 71 | All query functions, write/insert guard, notebook assignment/move, permanent delete, `findRecentNoteByTitle`, edge cases (not-found, deleted, trashed) |
| `html.test.ts` | 35 | `htmlToMarkdown`, `markdownToHtml`, round-trips |
| `writer.test.ts` | 23 | URL building for all endpoints, encoding, param inclusion/exclusion |
| `paths.test.ts` | 12 | DB path resolution, schema version guard, error cases |

Tests use an **in-memory SQLite database** with synthetic fixture data. No real notes or personal data are accessed during testing. `child_process.execSync` is mocked so no URLs are opened.

---

## Limitations & Known Issues

| Issue | Detail |
|-------|--------|
| **Windows only** | The write path uses PowerShell `Start-Process` to invoke the `upnote://` URL scheme. macOS users can swap this for `open` in `packages/core/src/writer.ts`. |
| **No note update via x-callback-url** | UpNote's URL scheme has no edit endpoint. In-place editing uses the experimental SQLite write path. |
| **No attachment support** | The `files` table exists but attaching files requires an upload mechanism UpNote does not expose. |
| **Schema version tied to UpNote v16** | If UpNote updates its database schema, the `dataVersion` check will fail loudly. Open an issue with the new version number. |
| **IDs are UUIDs, not human-readable** | You need to run `upnote list notebooks` or `upnote list notes` to discover IDs before using commands that require them. |
| **Create with content takes 2–5 s** | `upnote_create_note` with `markdownContent` waits for UpNote's initial Firebase sync before writing HTML. This is intentional — writing too early causes the in-memory title-only state to win. Title-only creation is instant. |
| **Create → search delay** | Notes appear in `search_notes` / `list_notes` only after UpNote has written them to SQLite. For notes created with content, this happens during the two-phase write. For title-only notes, allow a second or two after creation. |
| **No real-time sync detection** | The tool reads a snapshot of the database. Changes made in UpNote after the last query won't be visible until the next query. |

---

## License

MIT — see [LICENSE](LICENSE).

---

*This project is not affiliated with or endorsed by UpNote. Use at your own risk. Always maintain backups of your notes.*
