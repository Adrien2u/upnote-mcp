import Database from 'better-sqlite3';

export const FAKE_NOTEBOOK_ID_1 = 'nb-aaaa-0001';
export const FAKE_NOTEBOOK_ID_2 = 'nb-bbbb-0002';
export const FAKE_NOTEBOOK_CHILD = 'nb-cccc-0003';
export const FAKE_NOTE_ID_1 = 'note-1111-aaaa';
export const FAKE_NOTE_ID_2 = 'note-2222-bbbb';
export const FAKE_NOTE_ID_PINNED = 'note-3333-cccc';
export const FAKE_NOTE_ID_TEMPLATE = 'note-4444-dddd';
export const FAKE_NOTE_ID_TRASHED = 'note-5555-eeee';
export const FAKE_NOTE_ID_DELETED = 'note-6666-ffff';
export const FAKE_TAG_ID = 'tag-1111-aaaa';

export function createTestDb(): Database.Database {
  const db = new Database(':memory:');

  db.exec(`
    CREATE TABLE notebooks (
      id TEXT PRIMARY KEY,
      title TEXT,
      cover TEXT,
      parent TEXT,
      notes TEXT,
      childNotebooks TEXT,
      highlighted INTEGER DEFAULT 0,
      inactive INTEGER DEFAULT 0,
      locked INTEGER DEFAULT 0,
      sortBy TEXT,
      synced INTEGER DEFAULT 0,
      deleted INTEGER DEFAULT 0,
      revision INTEGER,
      space TEXT,
      createdAt INTEGER,
      updatedAt INTEGER,
      activatedAt INTEGER,
      syncedAt INTEGER
    );

    CREATE TABLE notes (
      id TEXT PRIMARY KEY,
      html TEXT,
      text TEXT,
      title TEXT,
      summary TEXT,
      firstImage TEXT,
      filesCount INTEGER DEFAULT 0,
      fileIds TEXT,
      noteLinks TEXT,
      notebookLinks TEXT,
      tagLinks TEXT,
      bookmarked INTEGER DEFAULT 0,
      pinned INTEGER DEFAULT 0,
      highlighted INTEGER DEFAULT 0,
      trashed INTEGER DEFAULT 0,
      deleted INTEGER DEFAULT 0,
      shared INTEGER DEFAULT 0,
      synced INTEGER DEFAULT 1,
      syncedAt INTEGER,
      revision INTEGER,
      isTemplate INTEGER DEFAULT 0,
      rtl INTEGER DEFAULT 0,
      hasTodo INTEGER DEFAULT 0,
      space TEXT,
      createdAt INTEGER,
      updatedAt INTEGER
    );

    CREATE TABLE tags (
      id TEXT PRIMARY KEY,
      title TEXT,
      icon TEXT,
      notes TEXT,
      sortBy TEXT,
      inactive INTEGER DEFAULT 0,
      synced INTEGER DEFAULT 0,
      deleted INTEGER DEFAULT 0,
      revision INTEGER,
      space TEXT,
      createdAt INTEGER,
      updatedAt INTEGER,
      activatedAt INTEGER,
      syncedAt INTEGER
    );

    CREATE TABLE filters (
      id TEXT PRIMARY KEY,
      filterType TEXT,
      words TEXT,
      sortBy TEXT,
      synced INTEGER DEFAULT 0,
      deleted INTEGER DEFAULT 0,
      inactive INTEGER DEFAULT 0,
      revision INTEGER,
      space TEXT
    );

    CREATE TABLE files (
      id TEXT PRIMARY KEY,
      name TEXT,
      tag TEXT,
      version TEXT,
      downloadURL TEXT,
      synced INTEGER DEFAULT 0,
      deleted INTEGER DEFAULT 0,
      createdAt INTEGER,
      updatedAt INTEGER,
      syncedAt INTEGER
    );

    CREATE TABLE lists (
      id TEXT PRIMARY KEY,
      content TEXT,
      space TEXT,
      synced INTEGER DEFAULT 0,
      deleted INTEGER DEFAULT 0,
      revision INTEGER,
      syncedAt INTEGER
    );
  `);

  const now = Date.now();

  // Notebooks
  db.prepare(`INSERT INTO notebooks VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    FAKE_NOTEBOOK_ID_1, 'Work', null, null,
    JSON.stringify([FAKE_NOTE_ID_1, FAKE_NOTE_ID_2]),
    JSON.stringify([FAKE_NOTEBOOK_CHILD]),
    0, 0, 0, null, 1, 0, 1, null, now - 10000, now, null, null
  );
  db.prepare(`INSERT INTO notebooks VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    FAKE_NOTEBOOK_ID_2, 'Personal', null, null,
    JSON.stringify([FAKE_NOTE_ID_PINNED]),
    JSON.stringify([]),
    0, 0, 0, null, 1, 0, 1, null, now - 20000, now, null, null
  );
  db.prepare(`INSERT INTO notebooks VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    FAKE_NOTEBOOK_CHILD, 'Work / Archive', null, FAKE_NOTEBOOK_ID_1,
    JSON.stringify([]),
    JSON.stringify([]),
    0, 0, 0, null, 1, 0, 1, null, now - 5000, now, null, null
  );

  // Notes
  db.prepare(`INSERT INTO notes (id,html,text,title,summary,bookmarked,pinned,trashed,deleted,isTemplate,synced,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    FAKE_NOTE_ID_1,
    '<h1>Meeting Notes</h1><p>Discuss <strong>Q3 roadmap</strong></p><ul><li>Item A</li><li>Item B</li></ul>',
    'Meeting Notes Discuss Q3 roadmap Item A Item B',
    'Meeting Notes',
    'Discuss Q3 roadmap',
    0, 0, 0, 0, 0, 1, now - 5000, now - 1000
  );
  db.prepare(`INSERT INTO notes (id,html,text,title,summary,bookmarked,pinned,trashed,deleted,isTemplate,synced,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    FAKE_NOTE_ID_2,
    '<h2>Shopping List</h2><ul><li>Milk</li><li>Eggs</li></ul>',
    'Shopping List Milk Eggs',
    'Shopping List',
    'Milk, Eggs',
    1, 0, 0, 0, 0, 1, now - 3000, now - 500
  );
  db.prepare(`INSERT INTO notes (id,html,text,title,summary,bookmarked,pinned,trashed,deleted,isTemplate,synced,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    FAKE_NOTE_ID_PINNED,
    '<p>Important reminder</p>',
    'Important reminder',
    'Reminder',
    'Important reminder',
    0, 1, 0, 0, 0, 1, now - 2000, now - 200
  );
  db.prepare(`INSERT INTO notes (id,html,text,title,summary,bookmarked,pinned,trashed,deleted,isTemplate,synced,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    FAKE_NOTE_ID_TEMPLATE,
    '<h1>Weekly Review</h1><p>Template content</p>',
    'Weekly Review Template content',
    'Weekly Review Template',
    null,
    0, 0, 0, 0, 1, 1, now - 8000, now - 8000
  );
  db.prepare(`INSERT INTO notes (id,html,text,title,summary,bookmarked,pinned,trashed,deleted,isTemplate,synced,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    FAKE_NOTE_ID_TRASHED,
    '<p>Trashed note</p>',
    'Trashed note',
    'Old Note',
    null,
    0, 0, 1, 0, 0, 1, now - 9000, now - 9000
  );
  db.prepare(`INSERT INTO notes (id,html,text,title,summary,bookmarked,pinned,trashed,deleted,isTemplate,synced,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    FAKE_NOTE_ID_DELETED,
    '<p>Deleted note</p>',
    'Deleted note',
    'Deleted Note',
    null,
    0, 0, 0, 1, 0, 0, now - 9000, now - 9000
  );

  // Tag
  db.prepare(`INSERT INTO tags (id,title,icon,notes,inactive,synced,deleted,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)`).run(
    FAKE_TAG_ID, 'work', null,
    JSON.stringify([FAKE_NOTE_ID_1, FAKE_NOTE_ID_2]),
    0, 1, 0, now - 10000, now
  );

  // Filters
  db.prepare(`INSERT INTO filters (id,filterType,words,synced,deleted,inactive) VALUES (?,?,?,?,?,?)`).run(
    'filter-today', 'today', null, 1, 0, 0
  );
  db.prepare(`INSERT INTO filters (id,filterType,words,synced,deleted,inactive) VALUES (?,?,?,?,?,?)`).run(
    'filter-search', 'search', 'roadmap', 1, 0, 0
  );

  return db;
}
