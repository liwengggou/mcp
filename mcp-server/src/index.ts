#!/usr/bin/env node
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env from project root (parent of mcp-server)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
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

class ConceptTrackerServer {
  private server: Server;
  private storage: StorageService;
  private extractor: ExtractorService | null = null;
  private exportService: ExportService;
  private scanner: ScannerService;

  constructor() {
    this.server = new Server(
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

    this.storage = new StorageService();
    this.exportService = new ExportService(this.storage);
    this.scanner = new ScannerService();

    // Initialize extractor if API key is available
    try {
      this.extractor = new ExtractorService();
    } catch (error) {
      console.error('Warning: DeepSeek API key not configured. Extraction disabled.');
    }

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
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
      if (this.extractor) {
        tools.unshift(extractConceptsSchema);
      }

      return { tools };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        let result: string;

        switch (name) {
          case 'extract_concepts':
            if (!this.extractor) {
              throw new Error('Extraction not available: DEEPSEEK_API_KEY not configured');
            }
            result = await handleExtractConcepts(args, this.extractor, this.storage);
            break;

          case 'list_concepts':
            result = await handleListConcepts(args, this.storage);
            break;

          case 'get_concept':
            result = await handleGetConcept(args, this.storage);
            break;

          case 'add_concept':
            result = await handleAddConcept(args, this.storage);
            break;

          case 'update_concept':
            result = await handleUpdateConcept(args, this.storage);
            break;

          case 'delete_concept':
            result = await handleDeleteConcept(args, this.storage);
            break;

          case 'export_concepts':
            result = await handleExportConcepts(args, this.exportService);
            break;

          case 'scan_codebase':
            result = await handleScanCodebase(args, this.scanner, this.storage);
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
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Concept Tracker MCP server running on stdio');
  }
}

const server = new ConceptTrackerServer();
server.run().catch(console.error);
