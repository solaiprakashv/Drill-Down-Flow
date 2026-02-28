import React, { useState, useEffect } from 'react';
import { fetchCrossLinks, traverseCrossLink } from '../api/client';

/**
 * Panel showing words shared across multiple documents.
 * Clicking a word shows its parent lines in every document.
 */
export default function CrossLinkPanel({ onNavigateToDoc }) {
  const [links, setLinks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [parents, setParents] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCrossLinks()
      .then(setLinks)
      .catch(() => setLinks([]));
  }, []);

  async function handleWordClick(word) {
    setSelected(word);
    setLoading(true);
    try {
      const res = await traverseCrossLink({ word });
      setParents(res);
    } catch {
      setParents([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
        🔗 Cross-Document Links
      </h3>

      {links.length === 0 ? (
        <p className="text-xs text-gray-500">
          No shared words found across documents.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {links.map((l) => (
            <button
              key={l.word}
              onClick={() => handleWordClick(l.word)}
              className={`text-xs px-2 py-1 rounded-full border transition ${
                selected === l.word
                  ? 'bg-blue-800 border-blue-500 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-blue-600'
              }`}
            >
              {l.word}
              <span className="ml-1 text-gray-500">({l.documents.length})</span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="mt-4 space-y-2">
          <h4 className="text-xs text-gray-400 font-semibold">
            "{selected}" appears in:
          </h4>
          {loading ? (
            <p className="text-xs text-gray-500">Loading…</p>
          ) : parents.length === 0 ? (
            <p className="text-xs text-gray-500">No results.</p>
          ) : (
            parents.map((p, i) => (
              <button
                key={i}
                onClick={() => onNavigateToDoc(p.docId, p.lineIndex)}
                className="w-full text-left p-3 rounded-lg bg-gray-800 border border-gray-700
                           hover:border-blue-500 transition text-sm space-y-1"
              >
                <div className="text-blue-400 text-xs font-medium">
                  {p.docId} · Line {p.lineIndex}
                </div>
                <div className="text-gray-300 text-xs truncate">
                  {p.lineText}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
