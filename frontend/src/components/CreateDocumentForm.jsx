import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';

/**
 * Modal form that lets users create a new document by entering:
 *   - Document ID
 *   - Paragraph text (5+ lines)
 *   - Metadata key/value pairs
 */
export default function CreateDocumentForm({ open, onOpenChange, onCreate }) {
  const [docId, setDocId] = useState('');
  const [paragraph, setParagraph] = useState('');
  const [metaRows, setMetaRows] = useState([
    { key: 'author', value: '' },
    { key: 'category', value: '' },
  ]);
  const [error, setError] = useState('');

  function addMetaRow() {
    setMetaRows((prev) => [...prev, { key: '', value: '' }]);
  }

  function removeMetaRow(i) {
    setMetaRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateMetaRow(i, field, val) {
    setMetaRows((prev) =>
      prev.map((row, idx) => (idx === i ? { ...row, [field]: val } : row)),
    );
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError('');

    // Validation
    const trimmedId = docId.trim();
    if (!trimmedId) {
      setError('Document ID is required.');
      return;
    }
    if (!paragraph.trim()) {
      setError('Paragraph text is required.');
      return;
    }

    const lines = paragraph.split('\n').filter((l) => l.trim());
    if (lines.length < 5) {
      setError('Paragraph must have at least 5 non-empty lines.');
      return;
    }

    // Build metadata
    const metadata = {};
    for (const row of metaRows) {
      if (row.key.trim()) {
        metadata[row.key.trim()] = row.value.trim();
      }
    }

    onCreate({
      id: trimmedId,
      paragraph: paragraph,
      metadata,
    });

    // Reset form
    setDocId('');
    setParagraph('');
    setMetaRows([
      { key: 'author', value: '' },
      { key: 'category', value: '' },
    ]);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-900 border border-gray-700 rounded-2xl p-6 z-50 w-[560px] max-h-[90vh] overflow-y-auto space-y-5">
          <Dialog.Title className="text-xl font-bold text-gray-100">
            ✏️ Create New Document
          </Dialog.Title>
          <Dialog.Description className="text-sm text-gray-400">
            Enter a paragraph (at least 5 lines) and optional metadata fields.
            The document will be saved as a JSON file on the server.
          </Dialog.Description>

          {error && (
            <div className="px-3 py-2 bg-red-900/50 border border-red-800 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Document ID */}
            <label className="block text-sm text-gray-300">
              <span className="font-medium">Document ID</span>
              <input
                type="text"
                value={docId}
                onChange={(e) => setDocId(e.target.value)}
                placeholder="e.g. doc-004"
                className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-200 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </label>

            {/* Paragraph */}
            <label className="block text-sm text-gray-300">
              <span className="font-medium">Paragraph</span>
              <span className="text-gray-500 ml-2 text-xs">(one line per row, minimum 5 lines)</span>
              <textarea
                value={paragraph}
                onChange={(e) => setParagraph(e.target.value)}
                rows={8}
                placeholder={"Line one of your paragraph\nLine two of your paragraph\nLine three...\nLine four...\nLine five..."}
                className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-200 text-sm font-mono leading-relaxed focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-y"
              />
            </label>

            {/* Line count indicator */}
            <div className="text-xs text-gray-500">
              {paragraph.split('\n').filter((l) => l.trim()).length} / 5 lines entered
            </div>

            {/* Metadata */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-300">
                  Metadata (optional)
                </span>
                <button
                  type="button"
                  onClick={addMetaRow}
                  className="text-xs text-blue-400 hover:text-blue-300 transition"
                >
                  + Add field
                </button>
              </div>

              {metaRows.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={row.key}
                    onChange={(e) => updateMetaRow(i, 'key', e.target.value)}
                    placeholder="Key"
                    className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-gray-200 text-sm focus:border-blue-500 outline-none"
                  />
                  <input
                    type="text"
                    value={row.value}
                    onChange={(e) => updateMetaRow(i, 'value', e.target.value)}
                    placeholder="Value"
                    className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-gray-200 text-sm focus:border-blue-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeMetaRow(i)}
                    className="text-red-400 hover:text-red-300 text-sm px-1"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-3 border-t border-gray-800">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 font-medium transition"
              >
                Create Document
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
