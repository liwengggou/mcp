import { z } from 'zod';
import { ScannerService } from '../services/scanner.js';
import { StorageService } from '../services/storage.js';

export const scanCodebaseSchema = {
  name: 'scan_codebase',
  description: 'Scan project files for concept mentions and update code locations. Searches for concept names in source files.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      rootPath: {
        type: 'string',
        description: 'Root path of the project to scan'
      },
      conceptId: {
        type: 'string',
        description: 'Optional: Scan only for a specific concept by ID'
      },
      fileTypes: {
        type: 'array',
        items: { type: 'string' },
        description: 'File extensions to include (e.g., ["ts", "tsx", "js"]). Default: common source files'
      }
    },
    required: ['rootPath']
  }
};

export const ScanCodebaseInput = z.object({
  rootPath: z.string(),
  conceptId: z.string().optional(),
  fileTypes: z.array(z.string()).optional()
});

export async function handleScanCodebase(
  args: unknown,
  scanner: ScannerService,
  storage: StorageService
): Promise<string> {
  const input = ScanCodebaseInput.parse(args);

  // Get concepts to scan
  let concepts;
  if (input.conceptId) {
    const concept = await storage.getConceptById(input.conceptId);
    if (!concept) {
      return JSON.stringify({
        success: false,
        error: `Concept not found: ${input.conceptId}`
      });
    }
    concepts = [concept];
  } else {
    concepts = await storage.getAllConcepts();
  }

  // Scan for concepts
  const results = await scanner.scanAllConcepts(concepts, {
    rootPath: input.rootPath,
    includePatterns: input.fileTypes
  });

  // Update storage with new locations
  let updatedCount = 0;
  for (const [conceptId, locations] of results) {
    const locationStrings = locations.map(l => `${l.file}:${l.line}`);
    try {
      await storage.updateConcept(conceptId, { codeLocations: locationStrings });
      updatedCount++;
    } catch (error) {
      // Continue with other concepts if one fails
    }
  }

  // Format results for response
  const resultSummary: Record<string, { count: number; locations: string[] }> = {};
  for (const [conceptId, locations] of results) {
    const concept = concepts.find(c => c.id === conceptId);
    if (concept) {
      resultSummary[concept.name] = {
        count: locations.length,
        locations: locations.slice(0, 5).map(l => `${l.file}:${l.line}`)
      };
    }
  }

  return JSON.stringify({
    success: true,
    message: `Scanned ${concepts.length} concept(s), found matches for ${results.size}`,
    updatedConcepts: updatedCount,
    results: resultSummary
  });
}
