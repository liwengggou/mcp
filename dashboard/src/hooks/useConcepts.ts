import { useState, useEffect, useCallback } from 'react';
import { Concept, ConceptCategory } from '../types';

// API response type
interface ApiResponse {
  success: boolean;
  data?: {
    concepts: Concept[];
    total: number;
    returned: number;
  };
  error?: string;
}

// Fetch concepts from the API server
async function loadConcepts(): Promise<Concept[]> {
  try {
    const response = await fetch('/api/concepts');
    if (response.ok) {
      const result: ApiResponse = await response.json();
      if (result.success && result.data) {
        return result.data.concepts;
      }
    }
  } catch (error) {
    console.warn('Failed to load concepts from API:', error);
  }

  // Return demo data if API is not available
  return getDemoConcepts();
}

function getDemoConcepts(): Concept[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'demo-1',
      name: 'React Hooks',
      category: 'library',
      explanation: 'Functions that let you "hook into" React state and lifecycle features from function components.',
      chatSnippets: [],
      codeLocations: [],
      firstSeen: now,
      lastSeen: now
    },
    {
      id: 'demo-2',
      name: 'useState',
      category: 'library',
      parent: 'React Hooks',
      explanation: 'A Hook that lets you add state to functional components. Returns a stateful value and a function to update it.',
      chatSnippets: [],
      codeLocations: [],
      firstSeen: now,
      lastSeen: now
    },
    {
      id: 'demo-3',
      name: 'async/await',
      category: 'language',
      parent: 'JavaScript',
      explanation: 'Syntactic sugar for working with Promises, making asynchronous code look and behave more like synchronous code.',
      chatSnippets: [],
      codeLocations: [],
      firstSeen: now,
      lastSeen: now
    },
    {
      id: 'demo-4',
      name: 'Dependency Injection',
      category: 'pattern',
      explanation: 'A design pattern where dependencies are provided to a class rather than created internally, improving testability and flexibility.',
      chatSnippets: [],
      codeLocations: [],
      firstSeen: now,
      lastSeen: now
    },
    {
      id: 'demo-5',
      name: 'Microservices',
      category: 'architecture',
      explanation: 'An architectural style where an application is composed of small, independent services that communicate over APIs.',
      chatSnippets: [],
      codeLocations: [],
      firstSeen: now,
      lastSeen: now
    }
  ];
}

export function useConcepts() {
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ConceptCategory | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadConcepts();
      setConcepts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load concepts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filteredConcepts = concepts.filter(concept => {
    const matchesSearch = !search ||
      concept.name.toLowerCase().includes(search.toLowerCase()) ||
      concept.explanation.toLowerCase().includes(search.toLowerCase()) ||
      (concept.parent?.toLowerCase().includes(search.toLowerCase()));

    const matchesCategory = !categoryFilter || concept.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const stats = {
    total: concepts.length,
    byCategory: {
      language: concepts.filter(c => c.category === 'language').length,
      library: concepts.filter(c => c.category === 'library').length,
      pattern: concepts.filter(c => c.category === 'pattern').length,
      architecture: concepts.filter(c => c.category === 'architecture').length
    }
  };

  return {
    concepts: filteredConcepts,
    allConcepts: concepts,
    loading,
    error,
    search,
    setSearch,
    categoryFilter,
    setCategoryFilter,
    refresh,
    stats
  };
}
