import Database from 'better-sqlite3';
import { copyFileSync, existsSync, unlinkSync } from 'fs';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';
import { getDbPath, assertDataVersion } from './paths.js';
import type { Note, Notebook, Tag, Filter, NoteSummary, NotebookSummary, TagSummary, NoteUpdate } from './types.js';

// Injected by tests — bypasses file-copy and assertDataVersion
let _testDb: Database.Database | null = null;

export function __setTestDb(db: Database.Database | null): void {
  _testDb = db;
}

export function withDb<T>(fn: (db: Database.Database) => T): T {
  if (_testDb) return fn(_testDb);
  assertDataVersion();
  const src = getDbPath();
  const tmp = join(tmpdir(), `upnote_read_${Date.now()}.sqlite3`);
  copyFileSync(src, tmp);
  if (existsSync(`${src}-wal`)) copyFileSync(`${src}-wal`, `${tmp}-wal`);
  if (existsSync(`${src}-shm`)) copyFileSync(`${src}-shm`, `${tmp}-shm`);
  const db = new Database(tmp, { readonly: true });
  try {
    return fn(db);
  } finally {
    db.close();
    try { unlinkSync(tmp); } catch { /* best effort */ }
    try { unlinkSync(`${tmp}-wal`); } catch { /* best effort */ }
    try { unlinkSync(`${tmp}-shm`); } catch { /* best effort */ }
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
    return (db.prepare(`SELECT * FROM notes WHERE id=? AND deleted=0`).get(noteId) as Note | undefined) ?? null;
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
  if (_testDb) {
    const result = _testDb.prepare(
      `UPDATE notes SET html=?, text=?, title=?, summary=?, updatedAt=?, synced=0
       WHERE id=? AND deleted=0`
    ).run(fields.html, fields.text, fields.title, fields.summary, Date.now(), noteId);
    if (result.changes === 0) throw new Error(`Note not found or already deleted: ${noteId}`);
    return;
  }
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

export function insertNote(fields: NoteUpdate): string {
  const id = randomUUID();
  const now = Date.now();

  const doInsert = (db: Database.Database) => {
    db.prepare(
      `INSERT INTO notes (id, title, html, text, summary, synced, deleted, trashed, revision, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, 0, 0, 0, 0, ?, ?)`
    ).run(id, fields.title, fields.html, fields.text, fields.summary, now, now);
  };

  if (_testDb) {
    doInsert(_testDb);
    return id;
  }
  assertDataVersion();
  const db = new Database(getDbPath());
  try {
    doInsert(db);
  } finally {
    db.close();
  }
  return id;
}

export function findRecentNoteByTitle(title: string, since: number): string | null {
  return withDb((db) => {
    const row = db.prepare(
      `SELECT id FROM notes WHERE title=? AND deleted=0 AND createdAt>? ORDER BY createdAt DESC LIMIT 1`
    ).get(title, since) as { id: string } | undefined;
    return row?.id ?? null;
  });
}

export function getFilters(): Filter[] {
  return withDb((db) => {
    return db.prepare(`SELECT * FROM filters WHERE deleted=0`).all() as Filter[];
  });
}

export function assignNoteToNotebook(noteId: string, notebookId: string): void {
  const run = (db: Database.Database) => {
    const nb = db.prepare(`SELECT notes FROM notebooks WHERE id=? AND deleted=0`).get(notebookId) as { notes: string | null } | undefined;
    if (!nb) throw new Error(`Notebook not found: ${notebookId}`);
    const ids: string[] = nb.notes ? JSON.parse(nb.notes) : [];
    if (!ids.includes(noteId)) {
      ids.push(noteId);
      db.prepare(`UPDATE notebooks SET notes=?, synced=0, updatedAt=? WHERE id=?`).run(JSON.stringify(ids), Date.now(), notebookId);
    }
  };
  if (_testDb) { run(_testDb); return; }
  assertDataVersion();
  const db = new Database(getDbPath());
  try { run(db); } finally { db.close(); }
}

export function moveNoteToNotebook(noteId: string, notebookId: string): void {
  const run = (db: Database.Database) => {
    const target = db.prepare(`SELECT notes FROM notebooks WHERE id=? AND deleted=0`).get(notebookId) as { notes: string | null } | undefined;
    if (!target) throw new Error(`Notebook not found: ${notebookId}`);
    const now = Date.now();
    // Remove noteId from every other notebook that contains it
    const allNbs = db.prepare(`SELECT id, notes FROM notebooks WHERE deleted=0 AND id!=?`).all(notebookId) as Array<{ id: string; notes: string | null }>;
    for (const nb of allNbs) {
      const ids: string[] = nb.notes ? JSON.parse(nb.notes) : [];
      const idx = ids.indexOf(noteId);
      if (idx !== -1) {
        ids.splice(idx, 1);
        db.prepare(`UPDATE notebooks SET notes=?, synced=0, updatedAt=? WHERE id=?`).run(JSON.stringify(ids), now, nb.id);
      }
    }
    // Add to target (idempotent)
    const targetIds: string[] = target.notes ? JSON.parse(target.notes) : [];
    if (!targetIds.includes(noteId)) {
      targetIds.push(noteId);
      db.prepare(`UPDATE notebooks SET notes=?, synced=0, updatedAt=? WHERE id=?`).run(JSON.stringify(targetIds), now, notebookId);
    }
  };
  if (_testDb) { run(_testDb); return; }
  assertDataVersion();
  const db = new Database(getDbPath());
  try { run(db); } finally { db.close(); }
}

export function permanentlyDeleteNote(noteId: string): void {
  const run = (db: Database.Database) => {
    const note = db.prepare(`SELECT id FROM notes WHERE id=? AND trashed=1 AND deleted=0`).get(noteId) as { id: string } | undefined;
    if (!note) throw new Error(`Note not found in trash: ${noteId}`);
    db.prepare(`UPDATE notes SET deleted=1, updatedAt=?, synced=0 WHERE id=?`).run(Date.now(), noteId);
  };
  if (_testDb) { run(_testDb); return; }
  assertDataVersion();
  const db = new Database(getDbPath());
  try { run(db); } finally { db.close(); }
}
