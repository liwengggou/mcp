import { useState, useEffect } from 'react';
import { Concept } from '../types';

interface EditConceptModalProps {
  conceptId: string;
  onClose: () => void;
  onSave: () => void;
}

export function EditConceptModal({ conceptId, onClose, onSave }: EditConceptModalProps) {
  const [concept, setConcept] = useState<Concept | null>(null);
  const [name, setName] = useState('');
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConcept();
  }, [conceptId]);

  const loadConcept = async () => {
    try {
      const response = await fetch(`/api/concepts/${conceptId}`);
      const result = await response.json();

      if (result.success && result.data?.concept) {
        setConcept(result.data.concept);
        setName(result.data.concept.name);
        setExplanation(result.data.concept.explanation);
      } else {
        setError('Failed to load concept');
      }
    } catch (err) {
      setError('Failed to load concept');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !explanation.trim()) {
      setError('Name and explanation are required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/concepts/${conceptId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, explanation })
      });

      const result = await response.json();

      if (result.success) {
        onSave();
        onClose();
      } else {
        setError(result.error || 'Failed to save');
      }
    } catch (err) {
      setError('Failed to save concept');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this concept?')) {
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`/api/concepts/${conceptId}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        onSave();
        onClose();
      } else {
        setError(result.error || 'Failed to delete');
      }
    } catch (err) {
      setError('Failed to delete concept');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6">
        <h2 className="text-xl font-semibold mb-4">Edit Concept</h2>

        {loading ? (
          <div className="py-8 text-center text-gray-500">Loading...</div>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Explanation
              </label>
              <textarea
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {concept && (
              <div className="text-sm text-gray-500">
                <p>Category: {concept.category}</p>
                {concept.parent && <p>Parent: {concept.parent}</p>}
                <p>First seen: {new Date(concept.firstSeen).toLocaleDateString()}</p>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <button
                onClick={handleDelete}
                disabled={saving}
                className="px-4 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg disabled:opacity-50"
              >
                Delete
              </button>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  disabled={saving}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
