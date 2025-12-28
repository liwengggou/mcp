import { useState } from 'react';
import { TreeNode, CATEGORY_COLORS } from '../types';

interface ConceptTreeNodeProps {
  node: TreeNode;
  level: number;
  onDrop: (conceptId: string, newParentName: string | null) => void;
  onEdit: (conceptId: string) => void;
}

export function ConceptTreeNode({ node, level, onDrop, onEdit }: ConceptTreeNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('conceptId', node.concept.id);
    e.dataTransfer.setData('conceptName', node.concept.name);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer.types.includes('conceptid');
    if (draggedId) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer.getData('conceptId');
    const draggedName = e.dataTransfer.getData('conceptName');

    // Don't allow dropping on itself or its descendants
    if (draggedId !== node.concept.id && draggedName !== node.concept.name) {
      onDrop(draggedId, node.concept.name);
    }
    setIsDragOver(false);
  };

  const hasChildren = node.children.length > 0;

  return (
    <div style={{ marginLeft: level * 20 }}>
      <div
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex items-center gap-2 p-2 rounded cursor-grab active:cursor-grabbing
          ${isDragOver ? 'bg-blue-100 border-2 border-blue-400 border-dashed' : 'hover:bg-gray-50'}`}
      >
        {/* Expand/collapse button */}
        <button
          onClick={() => setExpanded(!expanded)}
          className={`w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 ${!hasChildren && 'invisible'}`}
        >
          {hasChildren && (expanded ? '▼' : '▶')}
        </button>

        {/* Category badge */}
        <span className={`px-2 py-0.5 text-xs font-medium rounded ${CATEGORY_COLORS[node.concept.category]}`}>
          {node.concept.category}
        </span>

        {/* Concept name */}
        <span className="font-medium text-gray-900 flex-1 min-w-0 truncate">
          {node.concept.name}
        </span>

        {/* Edit button */}
        <button
          onClick={() => onEdit(node.concept.id)}
          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
          title="Edit concept"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      </div>

      {/* Children */}
      {expanded && node.children.map(child => (
        <ConceptTreeNode
          key={child.concept.id}
          node={child}
          level={level + 1}
          onDrop={onDrop}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}
