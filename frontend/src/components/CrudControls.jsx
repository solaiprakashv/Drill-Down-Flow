import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';

/**
 * CRUD controls bar shown above the flow.
 * Insert / Delete / Reorder – all via POST to the backend.
 */
export default function CrudControls({
  documentId,
  level,
  parentIndex,
  nodeCount,
  onInsert,
  onDelete,
  onReorder,
}) {
  const [insertOpen, setInsertOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reorderOpen, setReorderOpen] = useState(false);

  const [insertPos, setInsertPos] = useState(0);
  const [insertVal, setInsertVal] = useState('');

  const [deletePos, setDeletePos] = useState(0);

  const [reorderFrom, setReorderFrom] = useState(0);
  const [reorderTo, setReorderTo] = useState(0);

  const levelName = { 1: 'Line', 2: 'Word', 3: 'Character' }[level] || 'Item';

  function handleInsert() {
    onInsert(insertPos, insertVal);
    setInsertOpen(false);
    setInsertVal('');
    setInsertPos(0);
  }

  function handleDelete() {
    onDelete(deletePos);
    setDeleteOpen(false);
    setDeletePos(0);
  }

  function handleReorder() {
    onReorder(reorderFrom, reorderTo);
    setReorderOpen(false);
    setReorderFrom(0);
    setReorderTo(0);
  }

  const btnClass =
    'px-3 py-1.5 rounded-lg text-xs font-medium transition border ';

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 border-b border-gray-800">
      <span className="text-[11px] text-gray-500 uppercase tracking-wider mr-2">
        CRUD
      </span>

      {/* ── INSERT ── */}
      <Dialog.Root open={insertOpen} onOpenChange={setInsertOpen}>
        <Dialog.Trigger asChild>
          <button className={btnClass + 'border-green-800 text-green-400 hover:bg-green-900/40'}>
            + Insert {levelName}
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-900 border border-gray-700 rounded-xl p-6 z-50 w-96 space-y-4">
            <Dialog.Title className="text-lg font-bold text-gray-100">
              Insert {levelName}
            </Dialog.Title>
            <label className="block text-sm text-gray-400">
              Position (0-indexed)
              <input
                type="number"
                min={0}
                max={nodeCount}
                value={insertPos}
                onChange={(e) => setInsertPos(Number(e.target.value))}
                className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-200 text-sm"
              />
            </label>
            <label className="block text-sm text-gray-400">
              Value
              <input
                value={insertVal}
                onChange={(e) => setInsertVal(e.target.value)}
                className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-200 text-sm"
                placeholder={`New ${levelName.toLowerCase()}...`}
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Dialog.Close asChild>
                <button className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                onClick={handleInsert}
                disabled={!insertVal}
                className="px-4 py-2 text-sm bg-green-700 text-white rounded-lg hover:bg-green-600 disabled:opacity-40"
              >
                Insert
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* ── DELETE ── */}
      <Dialog.Root open={deleteOpen} onOpenChange={setDeleteOpen}>
        <Dialog.Trigger asChild>
          <button className={btnClass + 'border-red-800 text-red-400 hover:bg-red-900/40'}>
            − Delete {levelName}
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-900 border border-gray-700 rounded-xl p-6 z-50 w-96 space-y-4">
            <Dialog.Title className="text-lg font-bold text-gray-100">
              Delete {levelName}
            </Dialog.Title>
            <label className="block text-sm text-gray-400">
              Position (0-indexed)
              <input
                type="number"
                min={0}
                max={Math.max(0, nodeCount - 1)}
                value={deletePos}
                onChange={(e) => setDeletePos(Number(e.target.value))}
                className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-200 text-sm"
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Dialog.Close asChild>
                <button className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm bg-red-700 text-white rounded-lg hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* ── REORDER ── */}
      <Dialog.Root open={reorderOpen} onOpenChange={setReorderOpen}>
        <Dialog.Trigger asChild>
          <button className={btnClass + 'border-yellow-800 text-yellow-400 hover:bg-yellow-900/40'}>
            ⇅ Reorder
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-900 border border-gray-700 rounded-xl p-6 z-50 w-96 space-y-4">
            <Dialog.Title className="text-lg font-bold text-gray-100">
              Reorder {levelName}
            </Dialog.Title>
            <label className="block text-sm text-gray-400">
              From index
              <input
                type="number"
                min={0}
                max={Math.max(0, nodeCount - 1)}
                value={reorderFrom}
                onChange={(e) => setReorderFrom(Number(e.target.value))}
                className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-200 text-sm"
              />
            </label>
            <label className="block text-sm text-gray-400">
              To index
              <input
                type="number"
                min={0}
                max={Math.max(0, nodeCount - 1)}
                value={reorderTo}
                onChange={(e) => setReorderTo(Number(e.target.value))}
                className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-200 text-sm"
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Dialog.Close asChild>
                <button className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                onClick={handleReorder}
                className="px-4 py-2 text-sm bg-yellow-700 text-white rounded-lg hover:bg-yellow-600"
              >
                Reorder
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Delimiter hint */}
      <span className="ml-auto text-[11px] text-gray-600">
        Level {level} · {nodeCount} node{nodeCount !== 1 ? 's' : ''}
      </span>
    </div>
  );
}
