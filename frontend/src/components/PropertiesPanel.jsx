import React from 'react';

/**
 * Sidebar showing all metadata fields from the JSON document
 * (everything except the paragraph).
 */
export default function PropertiesPanel({ metadata, docId }) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return (
      <div className="p-4 text-gray-500 text-sm">
        No metadata available.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
        Properties
      </h3>
      {docId && (
        <div className="text-xs text-gray-500 mb-3">
          Document: <span className="text-blue-400">{docId}</span>
        </div>
      )}
      {Object.entries(metadata).map(([key, value]) => (
        <div key={key} className="border-b border-gray-800 pb-2">
          <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
            {key}
          </div>
          <div className="text-sm text-gray-200 mt-0.5">
            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
          </div>
        </div>
      ))}
    </div>
  );
}
