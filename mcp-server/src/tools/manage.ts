import { z } from 'zod';
import { StorageService } from '../services/storage.js';
import { ConceptCategory } from '../types/concept.js';

export const addConceptSchema = {
  name: 'add_concept',
  description: 'Manually add a new technical concept to the knowledge base.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      name: {
        type: 'string',
        description: 'The concept name (e.g., "useState", "dependency injection")'
      },
      category: {
        type: 'string',
        enum: ['language', 'library', 'pattern', 'architecture'],
        description: 'The concept category'
      },
      explanation: {
        type: 'string',
        description: 'A clear explanation of the concept'
      },
      parent: {
        type: 'string',
        description: 'Parent concept if applicable (e.g., "React Hooks" for "useState")'
      }
    },
    required: ['name', 'category', 'explanation']
  }
};

export const AddConceptInput = z.object({
  name: z.string(),
  category: ConceptCategory,
  explanation: z.string(),
  parent: z.string().optional()
});

export async function handleAddConcept(
  args: unknown,
  storage: StorageService
): Promise<string> {
  const input = AddConceptInput.parse(args);

  const existing = await storage.getConceptByName(input.name);
  if (existing) {
    return JSON.stringify({
      success: false,
      error: `Concept already exists: ${input.name}`,
      existingId: existing.id
    });
  }

  const concept = await storage.addConcept({
    name: input.name,
    category: input.category,
    explanation: input.explanation,
    parent: input.parent
  });

  return JSON.stringify({
    success: true,
    message: `Added concept: ${concept.name}`,
    concept: {
      id: concept.id,
      name: concept.name,
      category: concept.category,
      parent: concept.parent,
      explanation: concept.explanation
    }
  });
}

export const updateConceptSchema = {
  name: 'update_concept',
  description: 'Update an existing concept\'s name or explanation.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      id: {
        type: 'string',
        description: 'The concept ID to update'
      },
      name: {
        type: 'string',
        description: 'New name for the concept'
      },
      explanation: {
        type: 'string',
        description: 'New explanation for the concept'
      }
    },
    required: ['id']
  }
};

export const UpdateConceptInput = z.object({
  id: z.string(),
  name: z.string().optional(),
  explanation: z.string().optional()
});

export async function handleUpdateConcept(
  args: unknown,
  storage: StorageService
): Promise<string> {
  const input = UpdateConceptInput.parse(args);

  try {
    const concept = await storage.updateConcept(input.id, {
      name: input.name,
      explanation: input.explanation
    });

    return JSON.stringify({
      success: true,
      message: `Updated concept: ${concept.name}`,
      concept: {
        id: concept.id,
        name: concept.name,
        explanation: concept.explanation
      }
    });
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export const deleteConceptSchema = {
  name: 'delete_concept',
  description: 'Delete a concept from the knowledge base.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      id: {
        type: 'string',
        description: 'The concept ID to delete'
      }
    },
    required: ['id']
  }
};

export const DeleteConceptInput = z.object({
  id: z.string()
});

export async function handleDeleteConcept(
  args: unknown,
  storage: StorageService
): Promise<string> {
  const input = DeleteConceptInput.parse(args);

  const deleted = await storage.deleteConcept(input.id);

  if (!deleted) {
    return JSON.stringify({
      success: false,
      error: `Concept not found: ${input.id}`
    });
  }

  return JSON.stringify({
    success: true,
    message: 'Concept deleted successfully'
  });
}
