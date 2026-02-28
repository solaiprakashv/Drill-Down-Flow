import React, { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// Color map per node level
const LEVEL_COLORS = {
  0: { bg: '#1e293b', border: '#334155', text: '#e2e8f0' }, // root / paragraph
  1: { bg: '#1e40af', border: '#2563eb', text: '#ffffff' }, // lines (blue)
  2: { bg: '#065f46', border: '#059669', text: '#ffffff' }, // words (green)
  3: { bg: '#9a3412', border: '#c2410c', text: '#ffffff' }, // characters (orange)
};

function getNodeStyle(data) {
  const nl = data?.nodeLevel ?? data?.level ?? 0;
  const isRoot = data?.isRoot;
  const colors = LEVEL_COLORS[nl] || LEVEL_COLORS[0];

  if (isRoot) {
    return {
      background: '#1e293b',
      color: '#e2e8f0',
      border: '2px solid #334155',
      borderRadius: '14px',
      padding: '10px 22px',
      fontWeight: 700,
      fontSize: '15px',
    };
  }

  if (nl === 3) {
    return {
      background: colors.bg,
      color: colors.text,
      border: `1px solid ${colors.border}`,
      borderRadius: '6px',
      padding: '4px 10px',
      fontSize: '16px',
      fontWeight: 700,
      minWidth: '36px',
      textAlign: 'center',
    };
  }

  return {
    background: colors.bg,
    color: colors.text,
    border: `1px solid ${colors.border}`,
    borderRadius: '10px',
    padding: nl === 1 ? '10px 18px' : '6px 14px',
    cursor: data?.canDrillDown ? 'pointer' : 'default',
    fontSize: nl === 1 ? '13px' : '12px',
    fontWeight: nl === 1 ? 600 : 500,
    textAlign: 'center',
    maxWidth: nl === 1 ? '220px' : '140px',
    wordBreak: 'break-word',
  };
}

/**
 * Renders the full drill-down tree using @xyflow/react.
 * Supports multi-level display: Paragraph→Lines→Words→Characters in one view.
 * Clicking a word node drills into characters.
 */
export default function FlowView({
  nodes: initialNodes,
  edges: initialEdges,
  level,
  onNodeClick,
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  React.useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const handleNodeClick = useCallback(
    (event, node) => {
      if (node.data?.isRoot) return;
      if (onNodeClick) onNodeClick(node);
    },
    [onNodeClick],
  );

  // Apply per-level styling
  const styledNodes = useMemo(
    () => nodes.map((n) => ({ ...n, style: getNodeStyle(n.data) })),
    [nodes],
  );

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={styledNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.05}
        maxZoom={3}
        defaultEdgeOptions={{
          style: { stroke: '#475569', strokeWidth: 1.5 },
        }}
      >
        <Background color="#1e293b" gap={24} />
        <Controls
          position="bottom-left"
          style={{ background: '#1e293b', border: '1px solid #334155' }}
        />
        <MiniMap
          nodeColor={(n) => {
            const nl = n.data?.nodeLevel ?? 0;
            return (LEVEL_COLORS[nl] || LEVEL_COLORS[0]).bg;
          }}
          maskColor="rgba(0,0,0,0.6)"
          style={{ background: '#0f172a' }}
        />
      </ReactFlow>
    </div>
  );
}
