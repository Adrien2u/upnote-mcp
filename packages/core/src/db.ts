import Database from 'better-sqlite3';
import { copyFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { getDbPath, assertDataVersion } from './paths.js';
import type { Note, Notebook, Tag, Filter, NoteSummary, NotebookSummary, TagSummary, NoteUpdate } from './types.js';

export function withDb<T>(fn: (db: Database.Database) => T): T {
  assertDataVersion();
  const src = getDbPath();
  const tmp = join(tmpdir(), `upnote_read_${Date.now()}.sqlite3`);
  copyFileSync(src, tmp);
  const db = new Database(tmp, { readonly: true });
  try {
    return fn(db);
  } finally {
    db.close();
    try { unlinkSync(tmp); } catch { /* best effort */ }
  }
}

export function listNotebooks(): NotebookSummary[] {
  return withDb((db) => {
    const rows = db.prepare(
      `SELECT id, title, notes, childNotebooks FROM notebooks WHERE deleted=0 AND inactive=0 ORDER BY title`
    ).all() as Array<{ id: string; title: string; notes: string | null; childNotebooks: string | null }>;

    return rows.map((r) => {
      const noteIds: string[] = r.notes ? JSON.parse(r.notes) : [];
      const children: string[] = r.childNotebooks ? JSON.parse(r.childNotebooks) : [];
      return {
        id: r.id,
        title: r.title,
        noteCount: noteIds.length,
        childNotebooks: children,
      };
    });
  });
}

export function listNotes(opts: { notebookId?: string; tag?: string; limit?: number; offset?: number } = {}): NoteSummary[] {
  return withDb((db) => {
    if (opts.notebookId) {
      const nb = db.prepare(`SELECT notes FROM notebooks WHERE id=?`).get(opts.notebookId) as { notes: string | null } | undefined;
      if (!nb) return [];
      const ids: string[] = nb.notes ? JSON.parse(nb.notes) : [];
      if (ids.length === 0) return [];
      const placeholders = ids.map(() => '?').join(',');
      return db.prepare(
        `SELECT id, title, summary, createdAt, updatedAt, bookmarked, pinned, isTemplate, trashed
         FROM notes WHERE id IN (${placeholders}) AND deleted=0 AND trashed=0
         ORDER BY updatedAt DESC LIMIT ? OFFSET ?`
      ).all(...ids, opts.limit ?? 100, opts.offset ?? 0) as NoteSummary[];
    }

    if (opts.tag) {
      const tagRow = db.prepare(`SELECT notes FROM tags WHERE title=? AND deleted=0`).get(opts.tag) as { notes: string | null } | undefined;
      if (!tagRow) return [];
      const ids: string[] = tagRow.notes ? JSON.parse(tagRow.notes) : [];
      if (ids.length === 0) return [];
      const placeholders = ids.map(() => '?').join(',');
      return db.prepare(
        `SELECT id, title, summary, createdAt, updatedAt, bookmarked, pinned, isTemplate, trashed
         FROM notes WHERE id IN (${placeholders}) AND deleted=0 AND trashed=0
         ORDER BY updatedAt DESC LIMIT ? OFFSET ?`
      ).all(...ids, opts.limit ?? 100, opts.offset ?? 0) as NoteSummary[];
    }

    return db.prepare(
      `SELECT id, title, summary, createdAt, updatedAt, bookmarked, pinned, isTemplate, trashed
       FROM notes WHERE deleted=0 AND trashed=0
       ORDER BY updatedAt DESC LIMIT ? OFFSET ?`
    ).all(opts.limit ?? 100, opts.offset ?? 0) as NoteSummary[];
  });
}

export function searchNotes(query: string, limit = 20): NoteSummary[] {
  return withDb((db) => {
    const q = `%${query}%`;
    return db.prepare(
      `SELECT id, title, summary, createdAt, updatedAt, bookmarked, pinned, isTemplate, trashed
       FROM notes WHERE deleted=0 AND trashed=0 AND (title LIKE ? OR text LIKE ?)
       ORDER BY updatedAt DESC LIMIT ?`
    ).all(q, q, limit) as NoteSummary[];
  });
}

export function getNote(noteId: string): Note | null {
  return withDb((db) => {
    return db.prepare(`SELECT * FROM notes WHERE id=? AND deleted=0`).get(noteId) as Note | null;
  });
}

export function listTags(): TagSummary[] {
  return withDb((db) => {
    const rows = db.prepare(
      `SELECT id, title, notes FROM tags WHERE deleted=0 AND inactive=0 ORDER BY title`
    ).all() as Array<{ id: string; title: string; notes: string | null }>;

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      noteCount: r.notes ? (JSON.parse(r.notes) as string[]).length : 0,
    }));
  });
}

export function getBookmarked(): NoteSummary[] {
  return withDb((db) => {
    return db.prepare(
      `SELECT id, title, summary, createdAt, updatedAt, bookmarked, pinned, isTemplate, trashed
       FROM notes WHERE deleted=0 AND trashed=0 AND (bookmarked=1 OR pinned=1)
       ORDER BY updatedAt DESC`
    ).all() as NoteSummary[];
  });
}

export function listTemplates(): NoteSummary[] {
  return withDb((db) => {
    return db.prepare(
      `SELECT id, title, summary, createdAt, updatedAt, bookmarked, pinned, isTemplate, trashed
       FROM notes WHERE deleted=0 AND isTemplate=1
       ORDER BY title`
    ).all() as NoteSummary[];
  });
}

export function writeNote(noteId: string, fields: NoteUpdate): void {
  assertDataVersion();
  const dbPath = getDbPath();
  const db = new Database(dbPath);
  try {
    const result = db.prepare(
      `UPDATE notes SET html=?, text=?, title=?, summary=?, updatedAt=?, synced=0
       WHERE id=? AND deleted=0`
    ).run(fields.html, fields.text, fields.title, fields.summary, Date.now(), noteId);
    if (result.changes === 0) {
      throw new Error(`Note not found or already deleted: ${noteId}`);
    }
  } finally {
    db.close();
  }
}

export function getFilters(): Filter[] {
  return withDb((db) => {
    return db.prepare(`SELECT * FROM filters WHERE deleted=0`).all() as Filter[];
  });
}
