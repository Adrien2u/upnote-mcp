import { execSync } from 'child_process';

export interface CreateNoteOptions {
  title: string;
  markdownContent?: string;
  newWindow?: boolean;
}

export interface OpenNoteOptions {
  noteId: string;
  newWindow?: boolean;
}

function buildUrl(endpoint: string, params: Record<string, string | undefined>): string {
  const base = `upnote://x-callback-url/${endpoint}`;
  const filtered = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (filtered.length === 0) return base;
  const qs = filtered.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v!)}`).join('&');
  return `${base}?${qs}`;
}

function openUrl(url: string): void {
  // PowerShell Start-Process handles upnote:// URL scheme on Windows
  const escaped = url.replace(/'/g, "''");
  execSync(`powershell -Command "Start-Process '${escaped}'"`, { stdio: 'ignore' });
}

export function createNote(opts: CreateNoteOptions): void {
  // UpNote v1101+ uses note/new; text param is plain text only (markdown param removed)
  const url = buildUrl('note/new', {
    title: opts.title,
    text: opts.markdownContent,
    // notebookId no longer supported by URL scheme in v1101+
    newWindow: opts.newWindow ? 'true' : undefined,
  });
  openUrl(url);
}

export function openNote(opts: OpenNoteOptions): void {
  const url = buildUrl('openNote', {
    noteId: opts.noteId,
    newWindow: opts.newWindow ? 'true' : undefined,
  });
  openUrl(url);
}

export function createNotebook(title: string): void {
  openUrl(buildUrl('createNotebook', { title }));
}

export function openNotebook(notebookId: string): void {
  openUrl(buildUrl('openNotebook', { notebookId }));
}

export function searchUi(query: string): void {
  openUrl(buildUrl('search', { query }));
}

export function viewTag(tagName: string): void {
  openUrl(buildUrl('tag/view', { tag: tagName }));
}

export function viewFilter(filterId: string): void {
  openUrl(buildUrl('openFilter', { filterId }));
}
