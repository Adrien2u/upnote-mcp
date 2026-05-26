export interface Note {
  id: string;
  title: string;
  html: string;
  text: string;
  summary: string | null;
  firstImage: string | null;
  bookmarked: number;
  pinned: number;
  highlighted: number;
  trashed: number;
  deleted: number;
  shared: number;
  isTemplate: number;
  hasTodo: number;
  rtl: number;
  synced: number;
  revision: number | null;
  noteLinks: string | null;
  notebookLinks: string | null;
  tagLinks: string | null;
  space: string | null;
  createdAt: number;
  updatedAt: number;
  syncedAt: number | null;
}

export interface Notebook {
  id: string;
  title: string;
  cover: string | null;
  parent: string | null;
  notes: string | null;
  childNotebooks: string | null;
  highlighted: number;
  inactive: number;
  locked: number;
  sortBy: string | null;
  synced: number;
  deleted: number;
  revision: number | null;
  space: string | null;
  createdAt: number;
  updatedAt: number;
  activatedAt: number | null;
  syncedAt: number | null;
}

export interface Tag {
  id: string;
  title: string;
  icon: string | null;
  notes: string | null;
  sortBy: string | null;
  inactive: number;
  synced: number;
  deleted: number;
  revision: number | null;
  space: string | null;
  createdAt: number;
  updatedAt: number;
  activatedAt: number | null;
  syncedAt: number | null;
}

export interface Filter {
  id: string;
  filterType: string;
  words: string | null;
  sortBy: string | null;
  synced: number;
  deleted: number;
  inactive: number;
  revision: number | null;
  space: string | null;
}

export interface NoteUpdate {
  html: string;
  text: string;
  title: string;
  summary: string | null;
}

export interface NoteSummary {
  id: string;
  title: string;
  summary: string | null;
  createdAt: number;
  updatedAt: number;
  bookmarked: number;
  pinned: number;
  isTemplate: number;
  trashed: number;
}

export interface NotebookSummary {
  id: string;
  title: string;
  noteCount: number;
  childNotebooks: string[];
}

export interface TagSummary {
  id: string;
  title: string;
  noteCount: number;
}
