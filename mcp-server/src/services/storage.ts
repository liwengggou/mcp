import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { Concept, ConceptStore, ExtractedConcept } from '../types/concept.js';

export class StorageService {
  private storagePath: string;
  private store: ConceptStore | null = null;

  constructor(customPath?: string) {
    const basePath = customPath || process.env.STORAGE_PATH || path.join(os.homedir(), '.concept-tracker');
    this.storagePath = path.join(basePath, 'concepts.json');
  }

  private async ensureDirectory(): Promise<void> {
    const dir = path.dirname(this.storagePath);
    await fs.mkdir(dir, { recursive: true });
  }

  async load(): Promise<ConceptStore> {
    if (this.store) return this.store;

    try {
      await this.ensureDirectory();
      const data = await fs.readFile(this.storagePath, 'utf-8');
      this.store = ConceptStore.parse(JSON.parse(data));
    } catch (error) {
      // Initialize empty store if file doesn't exist
      this.store = {
        version: '1.0.0',
        concepts: [],
        lastUpdated: new Date().toISOString()
      };
    }

    return this.store;
  }

  async save(): Promise<void> {
    if (!this.store) return;

    await this.ensureDirectory();
    this.store.lastUpdated = new Date().toISOString();
    await fs.writeFile(
      this.storagePath,
      JSON.stringify(this.store, null, 2),
      'utf-8'
    );
  }

  async getAllConcepts(): Promise<Concept[]> {
    const store = await this.load();
    return store.concepts;
  }

  async getConceptById(id: string): Promise<Concept | undefined> {
    const store = await this.load();
    return store.concepts.find(c => c.id === id);
  }

  async getConceptByName(name: string): Promise<Concept | undefined> {
    const store = await this.load();
    return store.concepts.find(
      c => c.name.toLowerCase() === name.toLowerCase()
    );
  }

  async searchConcepts(query: string, category?: string): Promise<Concept[]> {
    const store = await this.load();
    const lowerQuery = query.toLowerCase();

    return store.concepts.filter(concept => {
      const matchesQuery = !query ||
        concept.name.toLowerCase().includes(lowerQuery) ||
        concept.explanation.toLowerCase().includes(lowerQuery);

      const matchesCategory = !category || concept.category === category;

      return matchesQuery && matchesCategory;
    });
  }

  async addConcept(extracted: ExtractedConcept, chatSnippet?: string): Promise<Concept> {
    const store = await this.load();

    // Check for existing concept with same name
    const existing = await this.getConceptByName(extracted.name);
    if (existing) {
      return this.updateConcept(existing.id, { chatSnippet });
    }

    const now = new Date().toISOString();
    const concept: Concept = {
      id: uuidv4(),
      name: extracted.name,
      category: extracted.category,
      parent: extracted.parent,
      explanation: extracted.explanation,
      chatSnippets: chatSnippet ? [{ timestamp: now, content: chatSnippet }] : [],
      codeLocations: [],
      firstSeen: now,
      lastSeen: now
    };

    store.concepts.push(concept);
    await this.save();

    return concept;
  }

  async updateConcept(
    id: string,
    updates: {
      name?: string;
      explanation?: string;
      chatSnippet?: string;
      codeLocations?: string[];
    }
  ): Promise<Concept> {
    const store = await this.load();
    const index = store.concepts.findIndex(c => c.id === id);

    if (index === -1) {
      throw new Error(`Concept not found: ${id}`);
    }

    const concept = store.concepts[index];
    const now = new Date().toISOString();

    if (updates.name) concept.name = updates.name;
    if (updates.explanation) concept.explanation = updates.explanation;
    if (updates.chatSnippet) {
      concept.chatSnippets.push({ timestamp: now, content: updates.chatSnippet });
    }
    if (updates.codeLocations) {
      concept.codeLocations = [...new Set([...concept.codeLocations, ...updates.codeLocations])];
    }
    concept.lastSeen = now;

    await this.save();
    return concept;
  }

  async deleteConcept(id: string): Promise<boolean> {
    const store = await this.load();
    const index = store.concepts.findIndex(c => c.id === id);

    if (index === -1) return false;

    store.concepts.splice(index, 1);
    await this.save();
    return true;
  }

  async addConceptsFromExtraction(
    concepts: ExtractedConcept[],
    chatContext?: string
  ): Promise<Concept[]> {
    const results: Concept[] = [];

    for (const extracted of concepts) {
      const concept = await this.addConcept(extracted, chatContext);
      results.push(concept);
    }

    return results;
  }

  getStoragePath(): string {
    return this.storagePath;
  }

  async updateConceptParent(id: string, parent: string | null): Promise<Concept> {
    const store = await this.load();
    const index = store.concepts.findIndex(c => c.id === id);

    if (index === -1) {
      throw new Error(`Concept not found: ${id}`);
    }

    // Validate parent exists if not null
    if (parent) {
      const parentConcept = store.concepts.find(c => c.name === parent);
      if (!parentConcept) {
        throw new Error(`Parent concept not found: ${parent}`);
      }

      // Prevent circular references
      if (this.wouldCreateCycle(store.concepts, id, parent)) {
        throw new Error('Cannot create circular reference');
      }
    }

    const concept = store.concepts[index];
    concept.parent = parent || undefined;
    concept.lastSeen = new Date().toISOString();

    await this.save();
    return concept;
  }

  private wouldCreateCycle(concepts: Concept[], childId: string, parentName: string): boolean {
    const child = concepts.find(c => c.id === childId);
    if (!child) return false;

    let current: string | undefined = parentName;
    const visited = new Set<string>();

    while (current) {
      if (current === child.name) return true;
      if (visited.has(current)) return true; // Already in a cycle
      visited.add(current);

      const parent = concepts.find(c => c.name === current);
      current = parent?.parent;
    }

    return false;
  }
}
