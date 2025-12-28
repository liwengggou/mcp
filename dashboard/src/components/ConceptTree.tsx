import { useState, useEffect, useCallback } from 'react';
import { TreeNode } from '../types';
import { ConceptTreeNode } from './ConceptTreeNode';
import { EditConceptModal } from './EditConceptModal';

export function ConceptTree() {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isRootDragOver, setIsRootDragOver] = useState(false);

  const loadTree = useCallback(async () => {
    try {
      const response = await fetch('/api/concepts/tree');
      const result = await response.json();

      if (result.success && result.data?.tree) {
        setTree(result.data.tree);
        setError(null);
      } else {
        setError('Failed to load concept tree');
      }
    } catch (err) {
      setError('Failed to load concept tree');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  const handleDrop = async (conceptId: string, newParentName: string | null) => {
    try {
      const response = await fetch(`/api/concepts/${conceptId}/parent`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parent: newParentName })
      });

      const result = await response.json();

      if (result.success) {
        loadTree(); // Refresh tree
      } else {
        alert(result.error || 'Failed to update parent');
      }
    } catch (err) {
      alert('Failed to update parent');
    }
  };

  const handleRootDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsRootDragOver(true);
  };

  const handleRootDragLeave = () => {
    setIsRootDragOver(false);
  };

  const handleRootDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const conceptId = e.dataTransfer.getData('conceptId');
    if (conceptId) {
      handleDrop(conceptId, null);
    }
    setIsRootDragOver(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{error}</p>
        <button
          onClick={loadTree}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <p className="mt-4">No concepts yet</p>
        <p className="text-sm">Start a conversation with Claude to extract concepts</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Instructions */}
      <div className="text-sm text-gray-500 mb-4 p-3 bg-gray-50 rounded-lg">
        Drag and drop concepts to reorganize the hierarchy. Drop on another concept to make it a child,
        or drop in the zone below to make it a root concept.
      </div>

      {/* Root drop zone */}
      <div
        onDragOver={handleRootDragOver}
        onDragLeave={handleRootDragLeave}
        onDrop={handleRootDrop}
        className={`border-2 border-dashed p-3 rounded-lg text-center text-sm transition-colors
          ${isRootDragOver
            ? 'border-blue-400 bg-blue-50 text-blue-600'
            : 'border-gray-200 text-gray-400'}`}
      >
        Drop here to make root-level concept
      </div>

      {/* Tree nodes */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        {tree.map(node => (
          <ConceptTreeNode
            key={node.concept.id}
            node={node}
            level={0}
            onDrop={handleDrop}
            onEdit={setEditingId}
          />
        ))}
      </div>

      {/* Edit modal */}
      {editingId && (
        <EditConceptModal
          conceptId={editingId}
          onClose={() => setEditingId(null)}
          onSave={loadTree}
        />
      )}
    </div>
  );
}
