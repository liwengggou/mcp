#!/usr/bin/env node
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env from project root (parent of mcp-server)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
// Also try current directory for when run from project root
dotenv.config();

import express from 'express';
import cors from 'cors';
import { StorageService } from './services/storage.js';
import { ExtractorService } from './services/extractor.js';
import { ExportService } from './services/export.js';
import { ScannerService } from './services/scanner.js';
import { ConceptCategory } from './types/concept.js';
import {
  getAdapterManager,
  CursorAdapter,
  ContinueAdapter,
  IDEType,
} from './adapters/index.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize services
const storage = new StorageService();
const exportService = new ExportService(storage);
const scanner = new ScannerService();
let extractor: ExtractorService | null = null;

try {
  extractor = new ExtractorService();
  console.log('DeepSeek API configured for concept extraction');
} catch {
  console.log('DeepSeek API not configured - extraction endpoint disabled');
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      extractionEnabled: !!extractor
    }
  });
});

// List concepts
app.get('/api/concepts', async (req, res) => {
  try {
    const { category, search, limit } = req.query;

    const concepts = await storage.searchConcepts(
      (search as string) || '',
      category as ConceptCategory | undefined
    );

    const limitNum = limit ? parseInt(limit as string, 10) : 50;
    const limited = concepts.slice(0, limitNum);

    res.json({
      success: true,
      data: {
        total: concepts.length,
        returned: limited.length,
        concepts: limited
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list concepts'
    });
  }
});

// Get concept hierarchy as tree (must be before :id route)
app.get('/api/concepts/tree', async (req, res) => {
  try {
    const concepts = await storage.getAllConcepts();

    // Build tree structure
    interface TreeNode {
      concept: typeof concepts[0];
      children: TreeNode[];
    }

    const nodeMap = new Map<string, TreeNode>();
    const roots: TreeNode[] = [];

    // Create nodes for all concepts
    for (const concept of concepts) {
      nodeMap.set(concept.name, { concept, children: [] });
    }

    // Build parent-child relationships
    for (const concept of concepts) {
      const node = nodeMap.get(concept.name)!;
      if (concept.parent && nodeMap.has(concept.parent)) {
        nodeMap.get(concept.parent)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    res.json({
      success: true,
      data: { tree: roots }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get concept tree'
    });
  }
});

// Get single concept
app.get('/api/concepts/:id', async (req, res) => {
  try {
    const concept = await storage.getConceptById(req.params.id);

    if (!concept) {
      return res.status(404).json({
        success: false,
        error: `Concept not found: ${req.params.id}`
      });
    }

    res.json({
      success: true,
      data: { concept }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get concept'
    });
  }
});

// Add concept
app.post('/api/concepts', async (req, res) => {
  try {
    const { name, category, explanation, parent } = req.body;

    if (!name || !category || !explanation) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, category, explanation'
      });
    }

    // Check if concept already exists
    const existing = await storage.getConceptByName(name);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: `Concept already exists: ${name}`,
        data: { existingId: existing.id }
      });
    }

    const concept = await storage.addConcept({
      name,
      category,
      explanation,
      parent
    });

    res.status(201).json({
      success: true,
      data: { concept }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add concept'
    });
  }
});

// Update concept
app.put('/api/concepts/:id', async (req, res) => {
  try {
    const { name, explanation } = req.body;

    const existing = await storage.getConceptById(req.params.id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: `Concept not found: ${req.params.id}`
      });
    }

    const concept = await storage.updateConcept(req.params.id, {
      name,
      explanation
    });

    res.json({
      success: true,
      data: { concept }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update concept'
    });
  }
});

// Delete concept
app.delete('/api/concepts/:id', async (req, res) => {
  try {
    const deleted = await storage.deleteConcept(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: `Concept not found: ${req.params.id}`
      });
    }

    res.json({
      success: true,
      data: { deleted: true }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete concept'
    });
  }
});

// Extract concepts from text
app.post('/api/extract', async (req, res) => {
  if (!extractor) {
    return res.status(503).json({
      success: false,
      error: 'Extraction not available: DEEPSEEK_API_KEY not configured'
    });
  }

  try {
    const { text, saveContext = true } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: text'
      });
    }

    const extracted = await extractor.extractConcepts(text);

    if (extracted.length === 0) {
      return res.json({
        success: true,
        data: {
          message: 'No technical concepts found in the provided text.',
          concepts: []
        }
      });
    }

    const contextSnippet = saveContext
      ? text.slice(0, 500) + (text.length > 500 ? '...' : '')
      : undefined;

    const savedConcepts = await storage.addConceptsFromExtraction(
      extracted,
      contextSnippet
    );

    res.json({
      success: true,
      data: {
        message: `Extracted and saved ${savedConcepts.length} concept(s).`,
        concepts: savedConcepts
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extract concepts'
    });
  }
});

// Update concept parent
app.patch('/api/concepts/:id/parent', async (req, res) => {
  try {
    const { parent } = req.body;

    const concept = await storage.updateConceptParent(
      req.params.id,
      parent === null ? null : parent
    );

    res.json({
      success: true,
      data: { concept }
    });
  } catch (error) {
    const status = (error as Error).message.includes('not found') ? 404 : 400;
    res.status(status).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update parent'
    });
  }
});

// Scan codebase for concepts
app.post('/api/scan', async (req, res) => {
  try {
    const { rootPath, conceptId, fileTypes } = req.body;

    if (!rootPath) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: rootPath'
      });
    }

    // Get concepts to scan
    let concepts;
    if (conceptId) {
      const concept = await storage.getConceptById(conceptId);
      if (!concept) {
        return res.status(404).json({
          success: false,
          error: `Concept not found: ${conceptId}`
        });
      }
      concepts = [concept];
    } else {
      concepts = await storage.getAllConcepts();
    }

    // Scan for concepts
    const results = await scanner.scanAllConcepts(concepts, {
      rootPath,
      includePatterns: fileTypes
    });

    // Update storage with new locations
    let updatedCount = 0;
    for (const [id, locations] of results) {
      const locationStrings = locations.map(l => `${l.file}:${l.line}`);
      try {
        await storage.updateConcept(id, { codeLocations: locationStrings });
        updatedCount++;
      } catch (error) {
        // Continue with other concepts
      }
    }

    // Format results
    const resultSummary: Record<string, { count: number; locations: string[] }> = {};
    for (const [id, locations] of results) {
      const concept = concepts.find(c => c.id === id);
      if (concept) {
        resultSummary[concept.name] = {
          count: locations.length,
          locations: locations.slice(0, 5).map(l => `${l.file}:${l.line}`)
        };
      }
    }

    res.json({
      success: true,
      data: {
        scannedConcepts: concepts.length,
        matchedConcepts: results.size,
        updatedConcepts: updatedCount,
        results: resultSummary
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to scan codebase'
    });
  }
});

// ============================================
// IDE-Specific Extraction Endpoints
// ============================================

// Initialize adapter manager
const adapterManager = getAdapterManager();

/**
 * Helper function to extract and save concepts from text
 */
async function extractAndSave(text: string, ide: IDEType): Promise<{
  success: boolean;
  message: string;
  concepts: unknown[];
}> {
  if (!extractor) {
    return {
      success: false,
      message: 'Extraction not available: DEEPSEEK_API_KEY not configured',
      concepts: [],
    };
  }

  if (!text || text.trim().length < 50) {
    return {
      success: true,
      message: 'Text too short for meaningful extraction',
      concepts: [],
    };
  }

  const extracted = await extractor.extractConcepts(text);

  if (extracted.length === 0) {
    return {
      success: true,
      message: 'No technical concepts found',
      concepts: [],
    };
  }

  const contextSnippet = text.slice(0, 500) + (text.length > 500 ? '...' : '');
  const savedConcepts = await storage.addConceptsFromExtraction(
    extracted,
    contextSnippet
  );

  console.log(`[${ide}] Extracted ${savedConcepts.length} concept(s)`);

  return {
    success: true,
    message: `Extracted and saved ${savedConcepts.length} concept(s) from ${ide}`,
    concepts: savedConcepts,
  };
}

// Cursor webhook endpoint
app.post('/api/extract/cursor', async (req, res) => {
  try {
    const cursorAdapter = new CursorAdapter();
    const context = await cursorAdapter.parseHookInput(req.body);

    if (!context) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Cursor hook payload',
      });
    }

    // Only process completed conversations
    if (context.status !== 'completed') {
      return res.json({
        success: true,
        data: { message: 'Skipped - conversation not completed', concepts: [] },
      });
    }

    // Get transcript from request body if provided directly
    const transcript = req.body.transcript || await cursorAdapter.getTranscript(context);

    if (!transcript) {
      return res.json({
        success: true,
        data: { message: 'No transcript available', concepts: [] },
      });
    }

    const result = await extractAndSave(transcript, 'cursor');

    res.json({
      success: result.success,
      data: {
        message: result.message,
        concepts: result.concepts,
        conversationId: context.conversationId,
      },
    });
  } catch (error) {
    console.error('[cursor] Extraction error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process Cursor event',
    });
  }
});

// Continue.dev webhook endpoint
app.post('/api/extract/continue', async (req, res) => {
  try {
    const continueAdapter = new ContinueAdapter();
    const context = await continueAdapter.parseHookInput(req.body);

    if (!context) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Continue.dev webhook payload',
      });
    }

    const transcript = await continueAdapter.getTranscript(context);

    if (!transcript) {
      return res.json({
        success: true,
        data: { message: 'No transcript available', concepts: [] },
      });
    }

    const result = await extractAndSave(transcript, 'continue');

    res.json({
      success: result.success,
      data: {
        message: result.message,
        concepts: result.concepts,
        sessionId: context.sessionId,
      },
    });
  } catch (error) {
    console.error('[continue] Extraction error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process Continue.dev event',
    });
  }
});

// IDE detection and status endpoint
app.get('/api/health/ides', async (_req, res) => {
  try {
    const status = await adapterManager.getStatus();
    const ides: Record<string, { detected: boolean; hookRegistered: boolean; name: string }> = {};

    for (const [type, info] of status) {
      ides[type] = {
        detected: info.detected,
        hookRegistered: info.hookRegistered,
        name: info.name,
      };
    }

    res.json({
      success: true,
      data: { ides },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get IDE status',
    });
  }
});

// Register hooks for all detected IDEs
app.post('/api/ides/register-hooks', async (req, res) => {
  try {
    const { hookBasePath } = req.body;

    if (!hookBasePath) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: hookBasePath',
      });
    }

    const results = await adapterManager.registerAllHooks(hookBasePath);
    const resultObj: Record<string, { success: boolean; message: string }> = {};

    for (const [type, result] of results) {
      resultObj[type] = result;
    }

    res.json({
      success: true,
      data: { results: resultObj },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to register hooks',
    });
  }
});

// Unregister hooks for all IDEs
app.post('/api/ides/unregister-hooks', async (_req, res) => {
  try {
    const results = await adapterManager.unregisterAllHooks();
    const resultObj: Record<string, { success: boolean; message: string }> = {};

    for (const [type, result] of results) {
      resultObj[type] = result;
    }

    res.json({
      success: true,
      data: { results: resultObj },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to unregister hooks',
    });
  }
});

// ============================================
// Export Endpoint
// ============================================

// Export concepts
app.get('/api/export', async (req, res) => {
  try {
    const format = (req.query.format as string) || 'json';
    const ids = req.query.ids as string | undefined;
    const includeSnippets = req.query.includeSnippets !== 'false';
    const includeCodeLocations = req.query.includeCodeLocations !== 'false';

    if (format !== 'json' && format !== 'markdown') {
      return res.status(400).json({
        success: false,
        error: 'Invalid format. Must be "json" or "markdown".'
      });
    }

    const conceptIds = ids ? ids.split(',').filter(Boolean) : undefined;

    const content = await exportService.exportConcepts({
      format,
      conceptIds,
      includeSnippets,
      includeCodeLocations
    });

    const mimeType = format === 'json' ? 'application/json' : 'text/markdown';
    const extension = format === 'json' ? 'json' : 'md';
    const filename = `concepts-${new Date().toISOString().split('T')[0]}.${extension}`;

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to export concepts'
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Concept Tracker API server running at http://localhost:${PORT}`);
  console.log(`Storage path: ${storage.getStoragePath()}`);
});
