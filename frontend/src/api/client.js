/**
 * API client – every interaction goes through the server.
 * No client-side text splitting.
 */

const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}

// ── Documents ─────────────────────────────────────────────────────────────────

export function fetchDocuments() {
  return request('/documents');
}

export function fetchDocument(docId) {
  return request(`/documents/${docId}`);
}

export function fetchMetadata(docId) {
  return request(`/documents/${docId}/metadata`);
}

export function createDocument({ id, paragraph, metadata }) {
  return request('/documents', {
    method: 'POST',
    body: JSON.stringify({ id, paragraph, metadata }),
  });
}

export function deleteDoc(docId) {
  return request(`/documents/${docId}`, { method: 'DELETE' });
}

// ── File Upload ──────────────────────────────────────────────────────────────

export async function uploadDocument(file, docId) {
  const formData = new FormData();
  formData.append('file', file);
  if (docId) formData.append('docId', docId);

  const res = await fetch(`${BASE}/documents/upload`, {
    method: 'POST',
    body: formData,
    // No Content-Type header — browser sets multipart boundary automatically
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Upload failed');
  }
  return res.json();
}

// ── Drill-Down (POST only) ───────────────────────────────────────────────────

export function drillDown({ documentId, level, parentText, parentIndex, delimiter }) {
  return request('/drilldown', {
    method: 'POST',
    body: JSON.stringify({ documentId, level, parentText, parentIndex, delimiter }),
  });
}

export function drillDownFull({ documentId, depth = 2, lineDelimiter, wordDelimiter, charDelimiter }) {
  return request('/drilldown/full', {
    method: 'POST',
    body: JSON.stringify({ documentId, depth, lineDelimiter, wordDelimiter, charDelimiter }),
  });
}

// ── Navigate Up ──────────────────────────────────────────────────────────────

export function navigateUp({ documentId, currentLevel, lineIndex, wordIndex }) {
  return request('/navigate/up', {
    method: 'POST',
    body: JSON.stringify({ documentId, currentLevel, lineIndex, wordIndex }),
  });
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export function mutateInsert({ documentId, level, parentIndex, lineIndex, position, value }) {
  return request('/mutate/insert', {
    method: 'POST',
    body: JSON.stringify({ documentId, level, parentIndex, lineIndex, position, value }),
  });
}

export function mutateDelete({ documentId, level, parentIndex, lineIndex, position }) {
  return request('/mutate/delete', {
    method: 'POST',
    body: JSON.stringify({ documentId, level, parentIndex, lineIndex, position }),
  });
}

export function mutateReorder({ documentId, level, parentIndex, lineIndex, fromIndex, toIndex }) {
  return request('/mutate/reorder', {
    method: 'POST',
    body: JSON.stringify({ documentId, level, parentIndex, lineIndex, fromIndex, toIndex }),
  });
}

// ── Health ────────────────────────────────────────────────────────────────────

export async function fetchHealth() {
  const res = await fetch('/health');
  return res.json();
}

// ── Cross-Links ──────────────────────────────────────────────────────────────

export function fetchCrossLinks() {
  return request('/crosslinks');
}

export function traverseCrossLink({ word, documentId }) {
  return request('/crosslinks/traverse', {
    method: 'POST',
    body: JSON.stringify({ word, documentId }),
  });
}

// ── Graph Management ─────────────────────────────────────────────────────

export function rebuildGraph() {
  return request('/graph/rebuild', { method: 'POST' });
}

export function graphWordParents({ word, documentId }) {
  return request('/graph/word/parents', {
    method: 'POST',
    body: JSON.stringify({ word, documentId }),
  });
}
