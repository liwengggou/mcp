import { z } from 'zod';
import { ExportService, ExportOptions } from '../services/export.js';

export const exportConceptsSchema = {
  name: 'export_concepts',
  description: 'Export concepts as JSON or Markdown documentation. Returns the formatted content.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      format: {
        type: 'string',
        enum: ['json', 'markdown'],
        description: 'Export format: json for raw data, markdown for formatted documentation'
      },
      conceptIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional: specific concept IDs to export. If omitted, exports all concepts.'
      },
      includeSnippets: {
        type: 'boolean',
        description: 'Include chat snippets in the export (default: true)'
      },
      includeCodeLocations: {
        type: 'boolean',
        description: 'Include code locations in the export (default: true)'
      }
    },
    required: ['format']
  }
};

export const ExportConceptsInput = z.object({
  format: z.enum(['json', 'markdown']),
  conceptIds: z.array(z.string()).optional(),
  includeSnippets: z.boolean().optional(),
  includeCodeLocations: z.boolean().optional()
});

export async function handleExportConcepts(
  args: unknown,
  exportService: ExportService
): Promise<string> {
  const input = ExportConceptsInput.parse(args);

  const options: ExportOptions = {
    format: input.format,
    conceptIds: input.conceptIds,
    includeSnippets: input.includeSnippets,
    includeCodeLocations: input.includeCodeLocations
  };

  const content = await exportService.exportConcepts(options);

  return JSON.stringify({
    success: true,
    format: input.format,
    content
  });
}
