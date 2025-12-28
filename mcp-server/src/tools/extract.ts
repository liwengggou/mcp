import { z } from 'zod';
import { ExtractorService } from '../services/extractor.js';
import { StorageService } from '../services/storage.js';

export const extractConceptsSchema = {
  name: 'extract_concepts',
  description: 'Extract technical concepts from conversation text using AI. Identifies programming concepts, libraries, patterns, and architectural decisions.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      text: {
        type: 'string',
        description: 'The conversation text to analyze for technical concepts'
      },
      saveContext: {
        type: 'boolean',
        description: 'Whether to save the original text as context (default: true)'
      }
    },
    required: ['text']
  }
};

export const ExtractConceptsInput = z.object({
  text: z.string(),
  saveContext: z.boolean().default(true)
});

export async function handleExtractConcepts(
  args: unknown,
  extractor: ExtractorService,
  storage: StorageService
): Promise<string> {
  const input = ExtractConceptsInput.parse(args);

  const extracted = await extractor.extractConcepts(input.text);

  if (extracted.length === 0) {
    return JSON.stringify({
      success: true,
      message: 'No technical concepts found in the provided text.',
      concepts: []
    });
  }

  const contextSnippet = input.saveContext
    ? input.text.slice(0, 500) + (input.text.length > 500 ? '...' : '')
    : undefined;

  const savedConcepts = await storage.addConceptsFromExtraction(
    extracted,
    contextSnippet
  );

  return JSON.stringify({
    success: true,
    message: `Extracted and saved ${savedConcepts.length} concept(s).`,
    concepts: savedConcepts.map(c => ({
      id: c.id,
      name: c.name,
      category: c.category,
      parent: c.parent,
      explanation: c.explanation
    }))
  });
}
