import { z } from 'zod';
import { StorageService } from '../services/storage.js';
import { ConceptCategory } from '../types/concept.js';

export const listConceptsSchema = {
  name: 'list_concepts',
  description: 'List all extracted concepts with optional filtering by category or search term.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      category: {
        type: 'string',
        enum: ['language', 'library', 'pattern', 'architecture'],
        description: 'Filter by concept category'
      },
      search: {
        type: 'string',
        description: 'Search term to filter concepts by name or explanation'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of concepts to return (default: 50)'
      }
    }
  }
};

export const ListConceptsInput = z.object({
  category: ConceptCategory.optional(),
  search: z.string().optional(),
  limit: z.number().default(50)
});

export async function handleListConcepts(
  args: unknown,
  storage: StorageService
): Promise<string> {
  const input = ListConceptsInput.parse(args);

  const concepts = await storage.searchConcepts(
    input.search || '',
    input.category
  );

  const limited = concepts.slice(0, input.limit);

  return JSON.stringify({
    success: true,
    total: concepts.length,
    returned: limited.length,
    concepts: limited.map(c => ({
      id: c.id,
      name: c.name,
      category: c.category,
      parent: c.parent,
      explanation: c.explanation,
      lastSeen: c.lastSeen
    }))
  });
}

export const getConceptSchema = {
  name: 'get_concept',
  description: 'Get detailed information about a specific concept by ID.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      id: {
        type: 'string',
        description: 'The concept ID'
      }
    },
    required: ['id']
  }
};

export const GetConceptInput = z.object({
  id: z.string()
});

export async function handleGetConcept(
  args: unknown,
  storage: StorageService
): Promise<string> {
  const input = GetConceptInput.parse(args);

  const concept = await storage.getConceptById(input.id);

  if (!concept) {
    return JSON.stringify({
      success: false,
      error: `Concept not found: ${input.id}`
    });
  }

  return JSON.stringify({
    success: true,
    concept
  });
}
