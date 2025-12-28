import OpenAI from 'openai';
import { ExtractedConcept, ExtractionResult } from '../types/concept.js';

const EXTRACTION_PROMPT = `You are a technical concept extractor. Analyze the following conversation and extract all technical concepts mentioned.

For each concept, provide:
- name: The concept name (e.g., "useState", "dependency injection", "async/await")
- category: One of "language" (language features), "library" (libraries/frameworks), "pattern" (design patterns), "architecture" (architectural concepts)
- parent: Parent concept if applicable (e.g., "React Hooks" for "useState", "JavaScript" for "async/await")
- explanation: A brief, clear explanation of the concept (1-2 sentences)

Rules:
1. Only extract genuine technical concepts, not generic terms
2. Be specific - prefer "React useState" over just "state"
3. Include both the concept name and parent for hierarchical concepts
4. Explanations should be beginner-friendly but technically accurate

Return your response as a JSON object with a "concepts" array:
{
  "concepts": [
    {
      "name": "useState",
      "category": "library",
      "parent": "React Hooks",
      "explanation": "A React Hook that lets you add state to functional components. Returns a stateful value and a function to update it."
    }
  ]
}

If no technical concepts are found, return: { "concepts": [] }`;

export class ExtractorService {
  private client: OpenAI;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.DEEPSEEK_API_KEY;
    if (!key) {
      throw new Error('DEEPSEEK_API_KEY is required');
    }

    this.client = new OpenAI({
      apiKey: key,
      baseURL: 'https://api.deepseek.com/v1'
    });
  }

  async extractConcepts(text: string): Promise<ExtractedConcept[]> {
    try {
      const response = await this.client.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: EXTRACTION_PROMPT },
          { role: 'user', content: text }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return [];
      }

      const parsed = JSON.parse(content);
      const result = ExtractionResult.safeParse(parsed);

      if (!result.success) {
        console.error('Failed to parse extraction result:', result.error.message);
        return [];
      }

      return result.data.concepts;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Extraction failed:', message);
      throw new Error(`Extraction failed: ${message}`);
    }
  }
}
