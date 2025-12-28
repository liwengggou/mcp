export type ConceptCategory = 'language' | 'library' | 'pattern' | 'architecture';

export interface ChatSnippet {
  timestamp: string;
  content: string;
}

export interface Concept {
  id: string;
  name: string;
  category: ConceptCategory;
  parent?: string;
  explanation: string;
  chatSnippets: ChatSnippet[];
  codeLocations: string[];
  firstSeen: string;
  lastSeen: string;
}

export interface ConceptStore {
  version: string;
  concepts: Concept[];
  lastUpdated: string;
}

export interface TreeNode {
  concept: Concept;
  children: TreeNode[];
}

export const CATEGORY_LABELS: Record<ConceptCategory, string> = {
  language: 'Language Feature',
  library: 'Library/Framework',
  pattern: 'Design Pattern',
  architecture: 'Architecture'
};

export const CATEGORY_COLORS: Record<ConceptCategory, string> = {
  language: 'bg-blue-100 text-blue-800',
  library: 'bg-green-100 text-green-800',
  pattern: 'bg-purple-100 text-purple-800',
  architecture: 'bg-orange-100 text-orange-800'
};
