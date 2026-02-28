import React from 'react';

const LEVEL_LABELS = { 1: 'Lines', 2: 'Words', 3: 'Characters' };

/**
 * Breadcrumb-style navigation bar showing the current drill-down path.
 * Each crumb is clickable to navigate back.
 */
export default function Breadcrumbs({ trail, onNavigate }) {
  return (
    <div className="flex items-center gap-1 text-sm text-gray-400 px-4 py-2 bg-gray-900 border-b border-gray-800 overflow-x-auto">
      <button
        onClick={() => onNavigate(-1)}
        className="hover:text-white transition font-medium shrink-0"
      >
        📂 Documents
      </button>

      {trail.map((crumb, i) => (
        <React.Fragment key={i}>
          <span className="text-gray-600 mx-1">/</span>
          <button
            onClick={() => onNavigate(i)}
            className={`hover:text-white transition shrink-0 ${
              i === trail.length - 1 ? 'text-blue-400 font-semibold' : ''
            }`}
          >
            {crumb.label || LEVEL_LABELS[crumb.level] || `Level ${crumb.level}`}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}
