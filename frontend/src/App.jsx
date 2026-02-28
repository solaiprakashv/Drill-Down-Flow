import React, { useState, useEffect, useCallback } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import * as Tabs from '@radix-ui/react-tabs';

import DocumentSelector from './components/DocumentSelector';
import FlowView from './components/FlowView';
import PropertiesPanel from './components/PropertiesPanel';
import CrudControls from './components/CrudControls';
import CrossLinkPanel from './components/CrossLinkPanel';
import Breadcrumbs from './components/Breadcrumbs';
import CreateDocumentForm from './components/CreateDocumentForm';
import FileUploadForm from './components/FileUploadForm';

import {
  fetchDocuments,
  fetchDocument,
  drillDown,
  drillDownFull,
  navigateUp,
  mutateInsert,
  mutateDelete,
  mutateReorder,
  createDocument,
  deleteDoc,
  fetchHealth,
  uploadDocument,
} from './api/client';

export default function App() {
  // ── State ──────────────────────────────────────────────────────────────
  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [metadata, setMetadata] = useState({});
  const [paragraph, setParagraph] = useState('');

  // Flow state
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [level, setLevel] = useState(0); // 0 = doc list, 1 = lines, 2 = words, 3 = chars
  const [parentText, setParentText] = useState('');
  const [parentIndex, setParentIndex] = useState(null);
  const [lineIndex, setLineIndex] = useState(null); // tracks which line when at word/char level

  // Navigation trail (breadcrumbs)
  const [trail, setTrail] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [neo4jConnected, setNeo4jConnected] = useState(null); // null=checking, true/false

  // ── Load document list on mount ────────────────────────────────────────
  const loadDocuments = useCallback(() => {
    fetchDocuments()
      .then(setDocuments)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    loadDocuments();
    // Check Neo4j connectivity
    fetchHealth()
      .then((h) => setNeo4jConnected(h.neo4j === true))
      .catch(() => setNeo4jConnected(false));
  }, [loadDocuments]);

  // ── Load full tree for a document ──────────────────────────────────────
  // (kept for cross-link navigation, etc.)

  // ── Select a document → show lines (level 1) ──────────────────────────
  const selectDocument = useCallback(
    async (docId) => {
      setLoading(true);
      setError(null);
      try {
        const doc = await fetchDocument(docId);
        setSelectedDocId(docId);
        setMetadata(doc.metadata || {});
        setParagraph(doc.paragraph || '');

        const flow = await drillDown({
          documentId: docId,
          level: 1,
          parentText: doc.paragraph || '',
          parentIndex: null,
        });

        setNodes(flow.nodes);
        setEdges(flow.edges);
        setLevel(1);
        setParentText(doc.paragraph || '');
        setParentIndex(null);
        setLineIndex(null);
        setTrail([{ level: 1, label: docId, text: doc.paragraph }]);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // ── Node click → drill into next level ─────────────────────────────────
  const handleNodeClick = useCallback(
    async (node) => {
      if (node.data?.isRoot || !node.data?.canDrillDown) return;
      const nextLevel = level + 1;
      if (nextLevel > 3) return; // max level is chars

      setLoading(true);
      setError(null);
      try {
        const flow = await drillDown({
          documentId: selectedDocId,
          level: nextLevel,
          parentText: node.data.label,
          parentIndex: node.data.index,
        });

        setNodes(flow.nodes);
        setEdges(flow.edges);
        setLevel(nextLevel);
        setParentText(node.data.label);
        setParentIndex(node.data.index);
        // Track lineIndex: when drilling 1→2, the clicked node IS the line
        if (nextLevel === 2) {
          setLineIndex(node.data.index);
        }
        setTrail((prev) => [
          ...prev,
          {
            level: nextLevel,
            label: node.data.label?.slice(0, 30) || `Item ${node.data.index}`,
            text: node.data.label,
          },
        ]);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    },
    [selectedDocId, level],
  );

  // ── Navigate backward via breadcrumbs ──────────────────────────────────
  const handleBreadcrumbNav = useCallback(
    async (index) => {
      // index -1 = back to document list
      if (index < 0) {
        setSelectedDocId(null);
        setLevel(0);
        setTrail([]);
        setNodes([]);
        setEdges([]);
        return;
      }

      const target = trail[index];
      if (!target) return;

      setLoading(true);
      setError(null);
      try {
        const flow = await drillDown({
          documentId: selectedDocId,
          level: target.level,
          parentText: target.text,
          parentIndex: null,
        });

        setNodes(flow.nodes);
        setEdges(flow.edges);
        setLevel(target.level);
        setParentText(target.text);
        setParentIndex(null);
        // Restore lineIndex based on target level
        if (target.level <= 1) setLineIndex(null);
        setTrail((prev) => prev.slice(0, index + 1));
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    },
    [selectedDocId, trail],
  );

  // ── CRUD handlers ──────────────────────────────────────────────────────
  const refreshCurrentLevel = useCallback(async () => {
    if (!selectedDocId || level === 0) return;
    try {
      const doc = await fetchDocument(selectedDocId);
      setParagraph(doc.paragraph || '');

      let text = parentText;
      if (level === 1) {
        text = doc.paragraph || '';
      }

      const flow = await drillDown({
        documentId: selectedDocId,
        level,
        parentText: text,
        parentIndex,
      });
      setNodes(flow.nodes);
      setEdges(flow.edges);
    } catch (e) {
      setError(e.message);
    }
  }, [selectedDocId, level, parentText, parentIndex]);

  const handleInsert = useCallback(
    async (position, value) => {
      setError(null);
      try {
        await mutateInsert({
          documentId: selectedDocId,
          level,
          parentIndex,
          lineIndex,
          position,
          value,
        });
        await refreshCurrentLevel();
      } catch (e) {
        setError(e.message);
      }
    },
    [selectedDocId, level, parentIndex, lineIndex, refreshCurrentLevel],
  );

  const handleDelete = useCallback(
    async (position) => {
      setError(null);
      try {
        await mutateDelete({
          documentId: selectedDocId,
          level,
          parentIndex,
          lineIndex,
          position,
        });
        await refreshCurrentLevel();
      } catch (e) {
        setError(e.message);
      }
    },
    [selectedDocId, level, parentIndex, lineIndex, refreshCurrentLevel],
  );

  const handleReorder = useCallback(
    async (fromIndex, toIndex) => {
      setError(null);
      try {
        await mutateReorder({
          documentId: selectedDocId,
          level,
          parentIndex,
          lineIndex,
          fromIndex,
          toIndex,
        });
        await refreshCurrentLevel();
      } catch (e) {
        setError(e.message);
      }
    },
    [selectedDocId, level, parentIndex, lineIndex, refreshCurrentLevel],
  );

  // ── Create new document ────────────────────────────────────────────────
  const handleCreateDocument = useCallback(
    async ({ id, paragraph, metadata }) => {
      setError(null);
      try {
        await createDocument({ id, paragraph, metadata });
        setCreateOpen(false);
        loadDocuments(); // refresh list
      } catch (e) {
        setError(e.message);
      }
    },
    [loadDocuments],
  );

  // ── Delete document ────────────────────────────────────────────────────
  const handleDeleteDocument = useCallback(
    async (docId) => {
      if (!window.confirm(`Delete document "${docId}"? This cannot be undone.`)) return;
      setError(null);
      try {
        await deleteDoc(docId);
        loadDocuments();
        if (selectedDocId === docId) {
          setSelectedDocId(null);
          setLevel(0);
          setTrail([]);
          setNodes([]);
          setEdges([]);
        }
      } catch (e) {
        setError(e.message);
      }
    },
    [loadDocuments, selectedDocId],
  );

  // ── Upload file ────────────────────────────────────────────────────────
  const handleUploadFile = useCallback(
    async (file, docId) => {
      setError(null);
      try {
        const result = await uploadDocument(file, docId);
        loadDocuments(); // refresh list
        return result;
      } catch (e) {
        setError(e.message);
        throw e;
      }
    },
    [loadDocuments],
  );

  // ── Cross-link navigation ─────────────────────────────────────────────
  const handleCrossLinkNav = useCallback(
    async (docId, targetLineIndex) => {
      // Load the document first
      await selectDocument(docId);
      // If a specific line was targeted, drill into it
      if (targetLineIndex != null) {
        try {
          const doc = await fetchDocument(docId);
          const lines = (doc.paragraph || '').split('\n').filter(Boolean);
          if (targetLineIndex < lines.length) {
            const lineText = lines[targetLineIndex];
            const flow = await drillDown({
              documentId: docId,
              level: 2,
              parentText: lineText,
              parentIndex: targetLineIndex,
            });
            setNodes(flow.nodes);
            setEdges(flow.edges);
            setLevel(2);
            setParentText(lineText);
            setParentIndex(targetLineIndex);
            setLineIndex(targetLineIndex);
            setTrail((prev) => [
              ...prev,
              {
                level: 2,
                label: lineText.slice(0, 30),
                text: lineText,
              },
            ]);
          }
        } catch (e) {
          setError(e.message);
        }
      }
    },
    [selectDocument],
  );

  // ── Render ─────────────────────────────────────────────────────────────
  const nodeCount = nodes.filter((n) => !n.data?.isRoot).length;

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-950 text-white overflow-hidden">
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
        <h1 className="text-lg font-bold tracking-tight">
          🔍 Recursive Text Drill-Down
        </h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCreateOpen(true)}
            className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition"
          >
            + New Document
          </button>
          <button
            onClick={() => setUploadOpen(true)}
            className="px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition"
          >
            ⬆ Upload File
          </button>
          {/* Neo4j status badge */}
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${
              neo4jConnected === null
                ? 'bg-gray-700 text-gray-400'
                : neo4jConnected
                ? 'bg-green-900/60 text-green-300 border border-green-700'
                : 'bg-red-900/60 text-red-300 border border-red-700'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                neo4jConnected === null
                  ? 'bg-gray-500'
                  : neo4jConnected
                  ? 'bg-green-400 animate-pulse'
                  : 'bg-red-400'
              }`}
            />
            Neo4j {neo4jConnected === null ? '...' : neo4jConnected ? 'Connected' : 'Offline'}
          </span>
          <span className="text-xs text-gray-500">
            Aptean Hackathon
          </span>
        </div>
      </header>

      {/* ── Create Document Modal ── */}
      <CreateDocumentForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={handleCreateDocument}
      />

      {/* ── Upload File Modal ── */}
      <FileUploadForm
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUpload={handleUploadFile}
      />

      {/* ── Breadcrumbs ── */}
      {selectedDocId && (
        <Breadcrumbs trail={trail} onNavigate={handleBreadcrumbNav} />
      )}

      {/* ── Error bar ── */}
      {error && (
        <div className="px-4 py-2 bg-red-900/60 text-red-300 text-sm border-b border-red-800 shrink-0">
          ⚠ {error}
          <button
            onClick={() => setError(null)}
            className="ml-3 underline text-red-400"
          >
            dismiss
          </button>
        </div>
      )}

      {/* ── Main body ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left: Flow area ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {loading && (
            <div className="px-4 py-2 text-xs text-blue-400 bg-blue-900/20 shrink-0">
              Loading…
            </div>
          )}

          {level === 0 ? (
            <DocumentSelector
              documents={documents}
              onSelect={selectDocument}
              onDelete={handleDeleteDocument}
              onCreate={() => setCreateOpen(true)}
            />
          ) : (
            <>
              {/* ── Toolbar: Back + Level indicator + CRUD ── */}
              <div className="flex items-center gap-3 px-4 py-2 bg-gray-900/70 border-b border-gray-800 shrink-0 flex-wrap">
                <button
                  onClick={() => handleBreadcrumbNav(level > 1 ? trail.length - 2 : -1)}
                  className="px-3 py-1 text-xs font-medium bg-gray-700 hover:bg-gray-600 text-white rounded transition"
                >
                  ← {level === 1 ? 'Documents' : level === 2 ? 'Lines' : 'Words'}
                </button>

                <span className={`px-3 py-1 text-xs font-semibold rounded ${
                  level === 1 ? 'bg-blue-600 text-white' :
                  level === 2 ? 'bg-green-700 text-white' :
                  'bg-orange-700 text-white'
                }`}>
                  {level === 1 ? '📄 Lines' : level === 2 ? '📝 Words' : '🔤 Characters'}
                </span>

                <span className="text-xs text-gray-400">
                  {nodeCount} items • Click to drill down
                </span>

                <div className="ml-auto">
                  <CrudControls
                    documentId={selectedDocId}
                    level={level}
                    parentIndex={parentIndex}
                    nodeCount={nodeCount}
                    onInsert={handleInsert}
                    onDelete={handleDelete}
                    onReorder={handleReorder}
                  />
                </div>
              </div>

              <div className="flex-1">
                <ReactFlowProvider>
                  <FlowView
                    nodes={nodes}
                    edges={edges}
                    level={level}
                    onNodeClick={handleNodeClick}
                  />
                </ReactFlowProvider>
              </div>
            </>
          )}
        </div>

        {/* ── Right sidebar ── */}
        {selectedDocId && (
          <div className="w-72 border-l border-gray-800 bg-gray-900/50 shrink-0 overflow-y-auto">
            <Tabs.Root defaultValue="properties">
              <Tabs.List className="flex border-b border-gray-800">
                <Tabs.Trigger
                  value="properties"
                  className="flex-1 px-3 py-2 text-xs text-gray-400 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-blue-500 transition"
                >
                  Properties
                </Tabs.Trigger>
                <Tabs.Trigger
                  value="crosslinks"
                  className="flex-1 px-3 py-2 text-xs text-gray-400 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-blue-500 transition"
                >
                  Cross-Links
                </Tabs.Trigger>
              </Tabs.List>

              <Tabs.Content value="properties">
                <PropertiesPanel metadata={metadata} docId={selectedDocId} />
              </Tabs.Content>

              <Tabs.Content value="crosslinks">
                <CrossLinkPanel onNavigateToDoc={handleCrossLinkNav} />
              </Tabs.Content>
            </Tabs.Root>
          </div>
        )}
      </div>
    </div>
  );
}
