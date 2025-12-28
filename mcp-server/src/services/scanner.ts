import { promises as fs } from 'fs';
import path from 'path';
import { Concept } from '../types/concept.js';

export interface ScanOptions {
  rootPath: string;
  includePatterns?: string[];
  excludePatterns?: string[];
}

export interface CodeLocation {
  file: string;
  line: number;
  context: string;
}

export class ScannerService {
  private defaultInclude = ['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'java', 'cpp', 'c', 'h'];
  private defaultExclude = ['node_modules', 'dist', 'build', '.git', '__pycache__', 'target', 'vendor'];

  async scanForConcept(concept: Concept, options: ScanOptions): Promise<CodeLocation[]> {
    const locations: CodeLocation[] = [];
    const files = await this.getFiles(options);

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          // Case-insensitive word boundary search for concept name
          const regex = new RegExp(`\\b${this.escapeRegex(concept.name)}\\b`, 'gi');
          if (regex.test(lines[i])) {
            const relativePath = path.relative(options.rootPath, file);
            locations.push({
              file: relativePath,
              line: i + 1,
              context: lines[i].trim().slice(0, 100)
            });
          }
        }
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }

    return locations;
  }

  async scanAllConcepts(
    concepts: Concept[],
    options: ScanOptions
  ): Promise<Map<string, CodeLocation[]>> {
    const results = new Map<string, CodeLocation[]>();

    for (const concept of concepts) {
      const locations = await this.scanForConcept(concept, options);
      if (locations.length > 0) {
        results.set(concept.id, locations);
      }
    }

    return results;
  }

  private async getFiles(options: ScanOptions): Promise<string[]> {
    const include = options.includePatterns || this.defaultInclude;
    const exclude = options.excludePatterns || this.defaultExclude;

    const files: string[] = [];
    await this.walkDirectory(options.rootPath, files, include, exclude);
    return files;
  }

  private async walkDirectory(
    dir: string,
    files: string[],
    include: string[],
    exclude: string[]
  ): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // Check if should be excluded
        if (exclude.some(pattern => entry.name === pattern || entry.name.startsWith('.'))) {
          continue;
        }

        if (entry.isDirectory()) {
          await this.walkDirectory(fullPath, files, include, exclude);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).slice(1);
          if (include.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      // Skip directories that can't be read
    }
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
