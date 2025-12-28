import { z } from 'zod';

export const ConceptCategory = z.enum([
  'language',    // Language features: async/await, generics, decorators
  'library',     // Libraries & frameworks: React hooks, Express middleware
  'pattern',     // Design patterns: dependency injection, observer
  'architecture' // Architecture: microservices, event sourcing
]);

export type ConceptCategory = z.infer<typeof ConceptCategory>;

export const ChatSnippet = z.object({
  timestamp: z.string(),
  content: z.string()
});

export type ChatSnippet = z.infer<typeof ChatSnippet>;

export const Concept = z.object({
  id: z.string().uuid(),
  name: z.string(),
  category: ConceptCategory,
  parent: z.string().optional(),
  explanation: z.string(),
  chatSnippets: z.array(ChatSnippet).default([]),
  codeLocations: z.array(z.string()).default([]),
  firstSeen: z.string(),
  lastSeen: z.string()
});

export type Concept = z.infer<typeof Concept>;

export const ConceptStore = z.object({
  version: z.string().default('1.0.0'),
  concepts: z.array(Concept).default([]),
  lastUpdated: z.string()
});

export type ConceptStore = z.infer<typeof ConceptStore>;

export const ExtractedConcept = z.object({
  name: z.string(),
  category: ConceptCategory,
  parent: z.string().optional(),
  explanation: z.string()
});

export type ExtractedConcept = z.infer<typeof ExtractedConcept>;

export const ExtractionResult = z.object({
  concepts: z.array(ExtractedConcept)
});

export type ExtractionResult = z.infer<typeof ExtractionResult>;
