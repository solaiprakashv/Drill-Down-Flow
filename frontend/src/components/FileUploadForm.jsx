import React, { useState, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';

const ACCEPTED = '.txt,.md,.text,.json,.png,.jpg,.jpeg,.gif,.bmp,.webp';
const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];

function getExt(name) {
  return (name || '').slice(name.lastIndexOf('.')).toLowerCase();
}

/**
 * Modal that lets users upload a text file (.txt/.md/.json) or image
 * to create a new document on the server.
 */
export default function FileUploadForm({ open, onOpenChange, onUpload }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null); // image data-url or text snippet
  const [docId, setDocId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  function reset() {
    setFile(null);
    setPreview(null);
    setDocId('');
    setError('');
    setResult(null);
  }

  function handleFileChange(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setError('');
    setResult(null);

    const ext = getExt(f.name);
    const stem = f.name.slice(0, f.name.lastIndexOf('.'));
    setDocId(stem.replace(/[^a-zA-Z0-9_-]/g, '_'));

    // Preview
    if (IMAGE_EXTS.includes(ext)) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target.result);
      reader.readAsDataURL(f);
    } else {
      // Read first 500 chars
      const textReader = new FileReader();
      textReader.onload = (ev) => setPreview(ev.target.result.slice(0, 500));
      textReader.readAsText(f);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!file) {
      setError('Please select a file.');
      return;
    }

    setUploading(true);
    try {
      const res = await onUpload(file, docId || null);
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  const isImage = file && IMAGE_EXTS.includes(getExt(file.name));

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-900 border border-gray-700 rounded-2xl p-6 z-50 w-[560px] max-h-[90vh] overflow-y-auto space-y-5">
          <Dialog.Title className="text-xl font-bold text-gray-100">
            📁 Upload Document / Image
          </Dialog.Title>
          <Dialog.Description className="text-sm text-gray-400">
            Upload a text file (.txt, .md, .json) or an image (.png, .jpg, .gif, .webp).
            Text files become drill-down documents. Images are stored and OCR is attempted.
          </Dialog.Description>

          {error && (
            <div className="px-3 py-2 bg-red-900/50 border border-red-800 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          {result ? (
            <div className="space-y-3">
              <div className="px-4 py-3 bg-green-900/40 border border-green-700 rounded-lg text-green-300 text-sm space-y-1">
                <p className="font-semibold">✅ Uploaded successfully!</p>
                <p>Document ID: <span className="font-mono text-white">{result.id}</span></p>
                <p>Type: {result.fileType}</p>
                {result.preview && (
                  <p className="text-xs text-gray-400 truncate">Preview: {result.preview}</p>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-gray-800">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 font-medium transition"
                  >
                    Done
                  </button>
                </Dialog.Close>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* File drop zone */}
              <div
                onClick={() => inputRef.current?.click()}
                className="flex flex-col items-center justify-center border-2 border-dashed border-gray-600 rounded-xl p-6 cursor-pointer hover:border-blue-500 transition group"
              >
                {file ? (
                  <div className="text-center space-y-2">
                    {isImage && preview ? (
                      <img
                        src={preview}
                        alt="preview"
                        className="max-h-40 mx-auto rounded-lg border border-gray-700"
                      />
                    ) : (
                      <div className="text-4xl">📄</div>
                    )}
                    <p className="text-sm text-gray-300 font-medium">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {(file.size / 1024).toFixed(1)} KB • Click to change
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="text-4xl mb-2 group-hover:scale-110 transition">📂</div>
                    <p className="text-sm text-gray-400">
                      Click to select a file
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      .txt, .md, .json, .png, .jpg, .gif, .webp (max 10 MB)
                    </p>
                  </>
                )}
                <input
                  ref={inputRef}
                  type="file"
                  accept={ACCEPTED}
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* Text preview */}
              {!isImage && preview && (
                <div className="bg-gray-800 rounded-lg p-3 max-h-32 overflow-y-auto">
                  <p className="text-xs text-gray-500 mb-1">File preview:</p>
                  <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono">
                    {preview}
                  </pre>
                </div>
              )}

              {/* Document ID */}
              <label className="block text-sm text-gray-300">
                <span className="font-medium">Document ID</span>
                <span className="text-gray-500 ml-2 text-xs">(auto-generated from filename)</span>
                <input
                  type="text"
                  value={docId}
                  onChange={(e) => setDocId(e.target.value)}
                  placeholder="e.g. my-document"
                  className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-200 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </label>

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
                  disabled={!file || uploading}
                  className="px-5 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? 'Uploading…' : '⬆ Upload'}
                </button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
