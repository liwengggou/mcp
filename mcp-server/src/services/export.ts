import { Concept } from '../types/concept.js';
import { StorageService } from './storage.js';

export interface ExportOptions {
  format: 'json' | 'markdown';
  conceptIds?: string[];
  includeSnippets?: boolean;
  includeCodeLocations?: boolean;
}

interface TreeNode {
  concept: Concept;
  children: TreeNode[];
}

export class ExportService {
  constructor(private storage: StorageService) {}

  async exportConcepts(options: ExportOptions): Promise<string> {
    const allConcepts = await this.storage.getAllConcepts();

    // Filter by IDs if specified
    const concepts = options.conceptIds?.length
      ? allConcepts.filter(c => options.conceptIds!.includes(c.id))
      : allConcepts;

    if (options.format === 'json') {
      return this.exportAsJson(concepts, options);
    } else {
      return this.exportAsMarkdown(concepts, options);
    }
  }

  private exportAsJson(concepts: Concept[], options: ExportOptions): string {
    const exportData = concepts.map(c => {
      const data: Record<string, unknown> = {
        id: c.id,
        name: c.name,
        category: c.category,
        parent: c.parent,
        explanation: c.explanation,
        firstSeen: c.firstSeen,
        lastSeen: c.lastSeen
      };

      if (options.includeSnippets !== false) {
        data.chatSnippets = c.chatSnippets;
      }

      if (options.includeCodeLocations !== false) {
        data.codeLocations = c.codeLocations;
      }

      return data;
    });

    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      count: concepts.length,
      concepts: exportData
    }, null, 2);
  }

  private exportAsMarkdown(concepts: Concept[], options: ExportOptions): string {
    const lines: string[] = [];

    // Header
    lines.push('# Concept Knowledge Base');
    lines.push('');
    lines.push(`*Exported on ${new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })}*`);
    lines.push('');
    lines.push(`**Total concepts:** ${concepts.length}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    // Build tree structure
    const tree = this.buildTree(concepts);

    // Group by category for root concepts
    const categories = ['language', 'library', 'pattern', 'architecture'] as const;
    const categoryTitles: Record<string, string> = {
      language: 'Language Features',
      library: 'Libraries & Frameworks',
      pattern: 'Design Patterns',
      architecture: 'Architecture'
    };

    for (const category of categories) {
      const categoryNodes = tree.filter(node => node.concept.category === category);

      if (categoryNodes.length === 0) continue;

      lines.push(`## ${categoryTitles[category]}`);
      lines.push('');

      for (const node of categoryNodes) {
        this.renderNode(node, lines, 3, options);
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  private buildTree(concepts: Concept[]): TreeNode[] {
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

    return roots;
  }

  private renderNode(
    node: TreeNode,
    lines: string[],
    level: number,
    options: ExportOptions
  ): void {
    const heading = '#'.repeat(Math.min(level, 6));
    const concept = node.concept;

    lines.push(`${heading} ${concept.name}`);
    lines.push('');

    if (concept.parent) {
      lines.push(`*Part of: ${concept.parent}*`);
      lines.push('');
    }

    lines.push(concept.explanation);
    lines.push('');

    // Code locations
    if (options.includeCodeLocations !== false && concept.codeLocations.length > 0) {
      lines.push('**Code Locations:**');
      for (const loc of concept.codeLocations) {
        lines.push(`- \`${loc}\``);
      }
      lines.push('');
    }

    // Chat snippets
    if (options.includeSnippets !== false && concept.chatSnippets.length > 0) {
      lines.push('**References:**');
      for (const snippet of concept.chatSnippets.slice(0, 3)) {
        const date = new Date(snippet.timestamp).toLocaleDateString();
        const content = snippet.content.length > 100
          ? snippet.content.slice(0, 100) + '...'
          : snippet.content;
        lines.push(`- *${date}*: ${content.replace(/\n/g, ' ')}`);
      }
      if (concept.chatSnippets.length > 3) {
        lines.push(`- *...and ${concept.chatSnippets.length - 3} more*`);
      }
      lines.push('');
    }

    // Render children
    for (const child of node.children) {
      this.renderNode(child, lines, level + 1, options);
    }
  }
}
