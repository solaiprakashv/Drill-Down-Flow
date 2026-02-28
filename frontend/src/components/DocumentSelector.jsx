import React from 'react';

/**
 * Card list for selecting from loaded JSON documents.
 * Includes delete button per doc and a create trigger.
 */
export default function DocumentSelector({ documents, onSelect, onDelete, onCreate }) {
  if (!documents || documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4">
        <p>No documents loaded yet.</p>
        <button
          onClick={onCreate}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition text-sm"
        >
          + Create Your First Document
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-100">
          📂 Select a Document
        </h2>
        <button
          onClick={onCreate}
          className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition"
        >
          + New Document
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="relative p-5 rounded-xl border border-gray-800 bg-gray-900
                       hover:border-blue-500 hover:bg-gray-800/80 transition-all
                       group"
          >
            {/* Delete button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(doc.id);
              }}
              className="absolute top-3 right-3 text-gray-600 hover:text-red-400 transition text-sm opacity-0 group-hover:opacity-100"
              title="Delete document"
            >
              🗑
            </button>

            {/* Clickable area */}
            <button
              onClick={() => onSelect(doc.id)}
              className="text-left w-full"
            >
              <div className="text-blue-400 font-semibold text-sm group-hover:text-blue-300">
                {doc.id}
              </div>
              <div className="text-gray-400 text-xs mt-1">
                {doc.lineCount} line{doc.lineCount !== 1 ? 's' : ''}
              </div>
              <div className="text-gray-300 text-sm mt-3 truncate">
                {doc.preview || '(empty)'}
              </div>
              {doc.metadata && Object.keys(doc.metadata).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {Object.entries(doc.metadata).slice(0, 3).map(([k, v]) => (
                    <span
                      key={k}
                      className="text-[10px] bg-gray-800 text-gray-400 rounded px-1.5 py-0.5"
                    >
                      {k}: {String(v).slice(0, 20)}
                    </span>
                  ))}
                </div>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
