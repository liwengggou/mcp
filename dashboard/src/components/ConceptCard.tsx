import { useState } from 'react';
import { Concept, CATEGORY_LABELS, CATEGORY_COLORS } from '../types';

interface ConceptCardProps {
  concept: Concept;
}

export function ConceptCard({ concept }: ConceptCardProps) {
  const [expanded, setExpanded] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {concept.name}
            </h3>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[concept.category]}`}>
              {CATEGORY_LABELS[concept.category]}
            </span>
          </div>

          {concept.parent && (
            <p className="text-sm text-gray-500 mt-0.5">
              Part of: <span className="font-medium">{concept.parent}</span>
            </p>
          )}

          <p className="text-gray-700 mt-2 text-sm leading-relaxed">
            {concept.explanation}
          </p>
        </div>
      </div>

      {/* Metadata */}
      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
        <span>First seen: {formatDate(concept.firstSeen)}</span>
        {concept.codeLocations.length > 0 && (
          <span>{concept.codeLocations.length} code location(s)</span>
        )}
        {concept.chatSnippets.length > 0 && (
          <span>{concept.chatSnippets.length} reference(s)</span>
        )}
      </div>

      {/* Expandable sections */}
      {(concept.chatSnippets.length > 0 || concept.codeLocations.length > 0) && (
        <button
          className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Show less' : 'Show details'}
        </button>
      )}

      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
          {concept.codeLocations.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-1">Code Locations</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                {concept.codeLocations.map((loc, i) => (
                  <li key={i} className="font-mono text-xs bg-gray-50 px-2 py-1 rounded">
                    {loc}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {concept.chatSnippets.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-1">Chat References</h4>
              <ul className="text-sm text-gray-600 space-y-2">
                {concept.chatSnippets.map((snippet, i) => (
                  <li key={i} className="bg-gray-50 px-3 py-2 rounded text-xs">
                    <span className="text-gray-400 block mb-1">
                      {formatDate(snippet.timestamp)}
                    </span>
                    <span className="text-gray-700">{snippet.content}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
