#!/usr/bin/env node
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express, { Request, Response } from 'express';
import cors from 'cors';

// Load .env from project root (parent of mcp-server)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { StorageService } from './services/storage.js';
import { ExtractorService } from './services/extractor.js';
import { ExportService } from './services/export.js';
import { ScannerService } from './services/scanner.js';

import { extractConceptsSchema, handleExtractConcepts } from './tools/extract.js';
import { listConceptsSchema, getConceptSchema, handleListConcepts, handleGetConcept } from './tools/query.js';
import {
  addConceptSchema,
  updateConceptSchema,
  deleteConceptSchema,
  handleAddConcept,
  handleUpdateConcept,
  handleDeleteConcept
} from './tools/manage.js';
import { exportConceptsSchema, handleExportConcepts } from './tools/export.js';
import { scanCodebaseSchema, handleScanCodebase } from './tools/scan.js';

// Store active transports by session ID
const transports: Map<string, SSEServerTransport> = new Map();

function createMCPServer(storage: StorageService, extractor: ExtractorService | null): Server {
  const server = new Server(
    {
      name: 'concept-tracker',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  const exportService = new ExportService(storage);
  const scanner = new ScannerService();

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools: any[] = [
      listConceptsSchema,
      getConceptSchema,
      addConceptSchema,
      updateConceptSchema,
      deleteConceptSchema,
      exportConceptsSchema,
      scanCodebaseSchema,
    ];

    // Only include extract tool if API key is configured
    if (extractor) {
      tools.unshift(extractConceptsSchema);
    }

    return { tools };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result: string;

      switch (name) {
        case 'extract_concepts':
          if (!extractor) {
            throw new Error('Extraction not available: DEEPSEEK_API_KEY not configured');
          }
          result = await handleExtractConcepts(args, extractor, storage);
          break;

        case 'list_concepts':
          result = await handleListConcepts(args, storage);
          break;

        case 'get_concept':
          result = await handleGetConcept(args, storage);
          break;

        case 'add_concept':
          result = await handleAddConcept(args, storage);
          break;

        case 'update_concept':
          result = await handleUpdateConcept(args, storage);
          break;

        case 'delete_concept':
          result = await handleDeleteConcept(args, storage);
          break;

        case 'export_concepts':
          result = await handleExportConcepts(args, exportService);
          break;

        case 'scan_codebase':
          result = await handleScanCodebase(args, scanner, storage);
          break;

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [{ type: 'text', text: result }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: false, error: errorMessage }) }],
        isError: true,
      };
    }
  });

  return server;
}

// Get or create storage for a user token
const userStorages = new Map<string, StorageService>();

function getStorageForUser(userToken: string): StorageService {
  if (!userStorages.has(userToken)) {
    // Create isolated storage path for this user
    const basePath = process.env.STORAGE_PATH || './data';
    const userPath = path.join(basePath, 'users', userToken);
    userStorages.set(userToken, new StorageService(userPath));
  }
  return userStorages.get(userToken)!;
}

// Validate user token format (simple alphanumeric + dashes, 8-64 chars)
function isValidUserToken(token: string): boolean {
  return /^[a-zA-Z0-9-]{8,64}$/.test(token);
}

// Initialize extractor once (shared across all users)
let extractor: ExtractorService | null = null;
try {
  extractor = new ExtractorService();
  console.log('DeepSeek extractor initialized');
} catch (error) {
  console.error('Warning: DeepSeek API key not configured. Extraction disabled.');
}

const app = express();
app.use(cors());

// Only use JSON parsing for non-MCP routes (MCP SDK needs raw body stream)
app.use((req, res, next) => {
  if (req.path === '/message') {
    next();
  } else {
    express.json()(req, res, next);
  }
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'concept-tracker-mcp',
    extractionEnabled: !!extractor
  });
});

// SSE endpoint - establishes the connection
app.get('/sse', async (req: Request, res: Response) => {
  const userToken = req.query.token as string;

  if (!userToken || !isValidUserToken(userToken)) {
    res.status(400).json({
      error: 'Invalid or missing user token',
      hint: 'Add ?token=your-unique-id (8-64 alphanumeric characters or dashes)'
    });
    return;
  }

  console.log(`New SSE connection for user: ${userToken}`);

  // Get user-specific storage
  const storage = getStorageForUser(userToken);

  // Create transport and server for this connection
  const transport = new SSEServerTransport('/message', res);
  const server = createMCPServer(storage, extractor);

  // Store transport with session ID
  transports.set(transport.sessionId, transport);

  // Clean up on disconnect
  res.on('close', () => {
    console.log(`SSE connection closed for user: ${userToken}`);
    transports.delete(transport.sessionId);
  });

  await server.connect(transport);
});

// Message endpoint - receives messages from client
app.post('/message', async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;

  if (!sessionId) {
    res.status(400).json({ error: 'Missing sessionId' });
    return;
  }

  const transport = transports.get(sessionId);
  if (!transport) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  await transport.handlePostMessage(req, res);
});

// Landing page with instructions
app.get('/', (req: Request, res: Response) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Concept Tracker MCP</title>
      <style>
        body { font-family: -apple-system, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
        pre { background: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; }
        h1 { color: #333; }
        .step { margin: 20px 0; padding: 15px; background: #f9f9f9; border-left: 3px solid #007acc; }
      </style>
    </head>
    <body>
      <h1>Concept Tracker MCP</h1>
      <p>A remote MCP server that extracts and tracks technical concepts from your AI coding conversations.</p>

      <h2>Setup for Cursor</h2>

      <div class="step">
        <h3>Step 1: Generate your unique token</h3>
        <p>Create a unique identifier for yourself (8-64 characters, alphanumeric and dashes only):</p>
        <pre>my-unique-user-id-123</pre>
      </div>

      <div class="step">
        <h3>Step 2: Add to Cursor MCP config</h3>
        <p>Open <code>~/.cursor/mcp.json</code> and add:</p>
        <pre>{
  "mcpServers": {
    "concept-tracker": {
      "url": "${baseUrl}/sse?token=YOUR_TOKEN_HERE"
    }
  }
}</pre>
      </div>

      <div class="step">
        <h3>Step 3: Restart Cursor</h3>
        <p>Restart Cursor to load the MCP server. You can then use commands like:</p>
        <ul>
          <li><code>extract_concepts</code> - Extract concepts from conversation</li>
          <li><code>list_concepts</code> - View your knowledge base</li>
          <li><code>add_concept</code> - Manually add a concept</li>
        </ul>
      </div>

      <h2>API Status</h2>
      <p>Extraction: <strong>${extractor ? 'Enabled' : 'Disabled'}</strong></p>
      <p>Check health: <a href="/health">/health</a></p>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3002;

app.listen(PORT, () => {
  console.log(`Concept Tracker MCP (SSE) running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse?token=YOUR_TOKEN`);
});
