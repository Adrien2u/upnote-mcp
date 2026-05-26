import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock child_process so no actual URLs are opened during tests
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

import { execSync } from 'child_process';
import { createNote, openNote, createNotebook, openNotebook, searchUi, viewTag, viewFilter } from '../writer.js';

const mockExec = execSync as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockExec.mockClear();
});

function getCapturedUrl(): string {
  const call = mockExec.mock.calls[0][0] as string;
  // Extract the URL from: powershell -Command "Start-Process '<url>'"
  const match = call.match(/Start-Process '(.+?)'/);
  if (!match) throw new Error(`Could not parse URL from: ${call}`);
  return match[1];
}

describe('createNote', () => {
  it('builds upnote://x-callback-url/createNote URL', () => {
    createNote({ title: 'Test Note' });
    expect(getCapturedUrl()).toContain('upnote://x-callback-url/createNote');
  });

  it('URL-encodes the title parameter', () => {
    createNote({ title: 'Hello World' });
    expect(getCapturedUrl()).toContain('title=Hello%20World');
  });

  it('includes markdown parameter when provided', () => {
    createNote({ title: 'T', markdownContent: '**bold**' });
    const url = getCapturedUrl();
    expect(url).toContain('markdown=');
    expect(url).toContain(encodeURIComponent('**bold**'));
  });

  it('includes notebookId when provided', () => {
    createNote({ title: 'T', notebookId: 'nb-123' });
    expect(getCapturedUrl()).toContain('notebookId=nb-123');
  });

  it('omits notebookId when not provided', () => {
    createNote({ title: 'T' });
    expect(getCapturedUrl()).not.toContain('notebookId');
  });

  it('includes newWindow=true when set', () => {
    createNote({ title: 'T', newWindow: true });
    expect(getCapturedUrl()).toContain('newWindow=true');
  });

  it('omits newWindow when false', () => {
    createNote({ title: 'T', newWindow: false });
    expect(getCapturedUrl()).not.toContain('newWindow');
  });

  it('calls execSync exactly once', () => {
    createNote({ title: 'T' });
    expect(mockExec).toHaveBeenCalledTimes(1);
  });

  it('uses powershell Start-Process', () => {
    createNote({ title: 'T' });
    const cmd = mockExec.mock.calls[0][0] as string;
    expect(cmd).toContain('powershell');
    expect(cmd).toContain('Start-Process');
  });

  it('handles special characters in title', () => {
    createNote({ title: 'Q&A / Notes' });
    const url = getCapturedUrl();
    expect(url).toContain('title=');
    // Ensure it's URL-encoded (& becomes %26)
    expect(url).toContain('%26');
  });
});

describe('openNote', () => {
  it('builds upnote://x-callback-url/openNote URL', () => {
    openNote({ noteId: 'note-abc' });
    expect(getCapturedUrl()).toContain('upnote://x-callback-url/openNote');
  });

  it('includes noteId parameter', () => {
    openNote({ noteId: 'note-xyz-123' });
    expect(getCapturedUrl()).toContain('noteId=note-xyz-123');
  });

  it('includes newWindow=true when set', () => {
    openNote({ noteId: 'note-abc', newWindow: true });
    expect(getCapturedUrl()).toContain('newWindow=true');
  });

  it('omits newWindow when false', () => {
    openNote({ noteId: 'note-abc', newWindow: false });
    expect(getCapturedUrl()).not.toContain('newWindow');
  });
});

describe('createNotebook', () => {
  it('builds upnote://x-callback-url/createNotebook URL', () => {
    createNotebook('My Notebook');
    expect(getCapturedUrl()).toContain('upnote://x-callback-url/createNotebook');
  });

  it('URL-encodes notebook title', () => {
    createNotebook('My Notebook');
    expect(getCapturedUrl()).toContain('title=My%20Notebook');
  });
});

describe('openNotebook', () => {
  it('builds upnote://x-callback-url/openNotebook URL', () => {
    openNotebook('nb-abc');
    expect(getCapturedUrl()).toContain('upnote://x-callback-url/openNotebook');
  });

  it('includes notebookId', () => {
    openNotebook('nb-xyz');
    expect(getCapturedUrl()).toContain('notebookId=nb-xyz');
  });
});

describe('searchUi', () => {
  it('builds upnote://x-callback-url/search URL', () => {
    searchUi('my query');
    expect(getCapturedUrl()).toContain('upnote://x-callback-url/search');
  });

  it('URL-encodes the search query', () => {
    searchUi('hello world');
    expect(getCapturedUrl()).toContain('query=hello%20world');
  });
});

describe('viewTag', () => {
  it('builds upnote://x-callback-url/viewTag URL', () => {
    viewTag('work');
    expect(getCapturedUrl()).toContain('upnote://x-callback-url/viewTag');
  });

  it('includes tag parameter', () => {
    viewTag('project-alpha');
    expect(getCapturedUrl()).toContain('tag=project-alpha');
  });
});

describe('viewFilter', () => {
  it('builds upnote://x-callback-url/openFilter URL', () => {
    viewFilter('today');
    expect(getCapturedUrl()).toContain('upnote://x-callback-url/openFilter');
  });

  it('includes filterId', () => {
    viewFilter('week');
    expect(getCapturedUrl()).toContain('filterId=week');
  });
});
