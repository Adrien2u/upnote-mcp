import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import {
  __setTestDb,
  listNotebooks,
  listNotes,
  searchNotes,
  getNote,
  listTags,
  getBookmarked,
  listTemplates,
  writeNote,
  getFilters,
} from '../db.js';
import {
  createTestDb,
  FAKE_NOTEBOOK_ID_1,
  FAKE_NOTEBOOK_ID_2,
  FAKE_NOTEBOOK_CHILD,
  FAKE_NOTE_ID_1,
  FAKE_NOTE_ID_2,
  FAKE_NOTE_ID_PINNED,
  FAKE_NOTE_ID_TEMPLATE,
  FAKE_NOTE_ID_TRASHED,
  FAKE_NOTE_ID_DELETED,
  FAKE_TAG_ID,
} from './fixtures/db.js';

let testDb: Database.Database;

beforeEach(() => {
  testDb = createTestDb();
  __setTestDb(testDb);
});

afterEach(() => {
  __setTestDb(null);
  testDb.close();
});

// ---------------------------------------------------------------------------
// listNotebooks
// ---------------------------------------------------------------------------
describe('listNotebooks', () => {
  it('returns all non-deleted non-inactive notebooks', () => {
    const nbs = listNotebooks();
    expect(nbs).toHaveLength(3);
  });

  it('includes note counts derived from notes JSON array', () => {
    const nb1 = listNotebooks().find((n) => n.id === FAKE_NOTEBOOK_ID_1)!;
    expect(nb1.noteCount).toBe(2);
  });

  it('includes childNotebooks array', () => {
    const nb1 = listNotebooks().find((n) => n.id === FAKE_NOTEBOOK_ID_1)!;
    expect(nb1.childNotebooks).toContain(FAKE_NOTEBOOK_CHILD);
  });

  it('returns empty childNotebooks for leaf notebooks', () => {
    const nb2 = listNotebooks().find((n) => n.id === FAKE_NOTEBOOK_ID_2)!;
    expect(nb2.childNotebooks).toHaveLength(0);
  });

  it('sorts notebooks alphabetically by title', () => {
    const titles = listNotebooks().map((n) => n.title);
    expect(titles).toEqual([...titles].sort());
  });
});

// ---------------------------------------------------------------------------
// listNotes
// ---------------------------------------------------------------------------
describe('listNotes', () => {
  it('returns all active non-trashed notes by default', () => {
    const notes = listNotes();
    expect(notes.length).toBeGreaterThanOrEqual(4);
    const ids = notes.map((n) => n.id);
    expect(ids).not.toContain(FAKE_NOTE_ID_TRASHED);
    expect(ids).not.toContain(FAKE_NOTE_ID_DELETED);
  });

  it('filters by notebookId', () => {
    const notes = listNotes({ notebookId: FAKE_NOTEBOOK_ID_1 });
    const ids = notes.map((n) => n.id);
    expect(ids).toContain(FAKE_NOTE_ID_1);
    expect(ids).toContain(FAKE_NOTE_ID_2);
    expect(ids).not.toContain(FAKE_NOTE_ID_PINNED);
  });

  it('returns empty array for non-existent notebookId', () => {
    expect(listNotes({ notebookId: 'does-not-exist' })).toHaveLength(0);
  });

  it('filters by tag name', () => {
    const notes = listNotes({ tag: 'work' });
    const ids = notes.map((n) => n.id);
    expect(ids).toContain(FAKE_NOTE_ID_1);
    expect(ids).toContain(FAKE_NOTE_ID_2);
  });

  it('returns empty array for non-existent tag', () => {
    expect(listNotes({ tag: 'nonexistent-tag' })).toHaveLength(0);
  });

  it('respects limit option', () => {
    expect(listNotes({ limit: 2 })).toHaveLength(2);
  });

  it('respects offset option', () => {
    const all = listNotes({ limit: 100 });
    const paged = listNotes({ limit: 100, offset: 1 });
    expect(paged).toHaveLength(all.length - 1);
  });

  it('orders by updatedAt descending', () => {
    const notes = listNotes();
    const times = notes.map((n) => n.updatedAt);
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it('includes expected fields on each note', () => {
    const note = listNotes()[0];
    expect(note).toHaveProperty('id');
    expect(note).toHaveProperty('title');
    expect(note).toHaveProperty('summary');
    expect(note).toHaveProperty('createdAt');
    expect(note).toHaveProperty('updatedAt');
    expect(note).toHaveProperty('bookmarked');
    expect(note).toHaveProperty('pinned');
    expect(note).toHaveProperty('isTemplate');
  });
});

// ---------------------------------------------------------------------------
// searchNotes
// ---------------------------------------------------------------------------
describe('searchNotes', () => {
  it('finds notes by title substring', () => {
    const results = searchNotes('Meeting');
    expect(results.map((n) => n.id)).toContain(FAKE_NOTE_ID_1);
  });

  it('finds notes by content text', () => {
    const results = searchNotes('roadmap');
    expect(results.map((n) => n.id)).toContain(FAKE_NOTE_ID_1);
  });

  it('returns empty array for no matches', () => {
    expect(searchNotes('zzz-no-match-zzz')).toHaveLength(0);
  });

  it('respects limit parameter', () => {
    const results = searchNotes('e', 1);
    expect(results).toHaveLength(1);
  });

  it('does not return trashed notes', () => {
    const results = searchNotes('Trashed');
    expect(results.map((n) => n.id)).not.toContain(FAKE_NOTE_ID_TRASHED);
  });

  it('does not return deleted notes', () => {
    const results = searchNotes('Deleted');
    expect(results.map((n) => n.id)).not.toContain(FAKE_NOTE_ID_DELETED);
  });

  it('is case-insensitive for ASCII', () => {
    const upper = searchNotes('MEETING');
    const lower = searchNotes('meeting');
    expect(upper.map((n) => n.id)).toEqual(expect.arrayContaining(lower.map((n) => n.id)));
  });
});

// ---------------------------------------------------------------------------
// getNote
// ---------------------------------------------------------------------------
describe('getNote', () => {
  it('returns full note by ID', () => {
    const note = getNote(FAKE_NOTE_ID_1);
    expect(note).not.toBeNull();
    expect(note!.id).toBe(FAKE_NOTE_ID_1);
    expect(note!.title).toBe('Meeting Notes');
  });

  it('returns html and text fields', () => {
    const note = getNote(FAKE_NOTE_ID_1)!;
    expect(note.html).toContain('<h1>');
    expect(note.text).toBeTruthy();
    expect(note.synced).toBeDefined();
  });

  it('returns null for non-existent note', () => {
    expect(getNote('does-not-exist')).toBeNull();
  });

  it('returns null for deleted notes', () => {
    expect(getNote(FAKE_NOTE_ID_DELETED)).toBeNull();
  });

  it('returns trashed notes (trashed is not filtered in getNote)', () => {
    const note = getNote(FAKE_NOTE_ID_TRASHED);
    expect(note).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// listTags
// ---------------------------------------------------------------------------
describe('listTags', () => {
  it('returns active tags', () => {
    const tags = listTags();
    expect(tags.length).toBeGreaterThanOrEqual(1);
  });

  it('includes correct note count', () => {
    const tag = listTags().find((t) => t.id === FAKE_TAG_ID)!;
    expect(tag.noteCount).toBe(2);
  });

  it('returns id, title, noteCount on each tag', () => {
    const tag = listTags()[0];
    expect(tag).toHaveProperty('id');
    expect(tag).toHaveProperty('title');
    expect(tag).toHaveProperty('noteCount');
  });
});

// ---------------------------------------------------------------------------
// getBookmarked
// ---------------------------------------------------------------------------
describe('getBookmarked', () => {
  it('returns bookmarked notes', () => {
    const ids = getBookmarked().map((n) => n.id);
    expect(ids).toContain(FAKE_NOTE_ID_2);
  });

  it('returns pinned notes', () => {
    const ids = getBookmarked().map((n) => n.id);
    expect(ids).toContain(FAKE_NOTE_ID_PINNED);
  });

  it('excludes non-bookmarked non-pinned notes', () => {
    const ids = getBookmarked().map((n) => n.id);
    expect(ids).not.toContain(FAKE_NOTE_ID_1);
  });

  it('excludes trashed and deleted notes', () => {
    const ids = getBookmarked().map((n) => n.id);
    expect(ids).not.toContain(FAKE_NOTE_ID_TRASHED);
    expect(ids).not.toContain(FAKE_NOTE_ID_DELETED);
  });
});

// ---------------------------------------------------------------------------
// listTemplates
// ---------------------------------------------------------------------------
describe('listTemplates', () => {
  it('returns only template notes', () => {
    const ids = listTemplates().map((n) => n.id);
    expect(ids).toContain(FAKE_NOTE_ID_TEMPLATE);
  });

  it('does not return regular notes', () => {
    const ids = listTemplates().map((n) => n.id);
    expect(ids).not.toContain(FAKE_NOTE_ID_1);
  });

  it('isTemplate flag is 1 on all returned notes', () => {
    expect(listTemplates().every((t) => t.isTemplate === 1)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// writeNote
// ---------------------------------------------------------------------------
describe('writeNote', () => {
  it('updates html, text, title, summary', () => {
    writeNote(FAKE_NOTE_ID_1, {
      html: '<p>Updated</p>',
      text: 'Updated',
      title: 'Updated Title',
      summary: 'Updated summary',
    });
    const row = testDb.prepare('SELECT html, title FROM notes WHERE id=?').get(FAKE_NOTE_ID_1) as { html: string; title: string };
    expect(row.html).toBe('<p>Updated</p>');
    expect(row.title).toBe('Updated Title');
  });

  it('sets synced=0 after write', () => {
    writeNote(FAKE_NOTE_ID_1, { html: '<p>x</p>', text: 'x', title: 'T', summary: null });
    const row = testDb.prepare('SELECT synced FROM notes WHERE id=?').get(FAKE_NOTE_ID_1) as { synced: number };
    expect(row.synced).toBe(0);
  });

  it('updates updatedAt timestamp', () => {
    const before = (testDb.prepare('SELECT updatedAt FROM notes WHERE id=?').get(FAKE_NOTE_ID_1) as { updatedAt: number }).updatedAt;
    writeNote(FAKE_NOTE_ID_1, { html: '<p>x</p>', text: 'x', title: 'T', summary: null });
    const after = (testDb.prepare('SELECT updatedAt FROM notes WHERE id=?').get(FAKE_NOTE_ID_1) as { updatedAt: number }).updatedAt;
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it('throws for non-existent noteId', () => {
    expect(() => writeNote('does-not-exist', { html: '', text: '', title: '', summary: null })).toThrow();
  });

  it('throws for deleted note', () => {
    expect(() => writeNote(FAKE_NOTE_ID_DELETED, { html: '', text: '', title: '', summary: null })).toThrow();
  });

  it('does not modify id or createdAt', () => {
    const before = testDb.prepare('SELECT id, createdAt FROM notes WHERE id=?').get(FAKE_NOTE_ID_1) as { id: string; createdAt: number };
    writeNote(FAKE_NOTE_ID_1, { html: '<p>x</p>', text: 'x', title: 'New', summary: null });
    const after = testDb.prepare('SELECT id, createdAt FROM notes WHERE id=?').get(FAKE_NOTE_ID_1) as { id: string; createdAt: number };
    expect(after.id).toBe(before.id);
    expect(after.createdAt).toBe(before.createdAt);
  });

  it('accepts null summary', () => {
    expect(() => writeNote(FAKE_NOTE_ID_1, { html: '<p>x</p>', text: 'x', title: 'T', summary: null })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getFilters
// ---------------------------------------------------------------------------
describe('getFilters', () => {
  it('returns active filters', () => {
    expect(getFilters().length).toBeGreaterThanOrEqual(2);
  });

  it('includes filterType field on each filter', () => {
    const types = getFilters().map((f) => f.filterType);
    expect(types).toContain('today');
    expect(types).toContain('search');
  });
});
