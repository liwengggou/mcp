import { z } from 'zod';

/**
 * IDE-specific configuration
 */
export const IDEConfigSchema = z.object({
  enabled: z.boolean().default(true),
  hookPath: z.string().optional(),
  autoRegister: z.boolean().default(true),
});

export type IDEConfig = z.infer<typeof IDEConfigSchema>;

/**
 * Extraction settings
 */
export const ExtractionConfigSchema = z.object({
  enabled: z.boolean().default(true),
  apiProvider: z.enum(['deepseek', 'openai', 'anthropic']).default('deepseek'),
  apiKey: z.string().optional(),
  minConversationLength: z.number().default(100),
  excludePatterns: z.array(z.string()).default([]),
});

export type ExtractionConfig = z.infer<typeof ExtractionConfigSchema>;

/**
 * Storage settings
 */
export const StorageConfigSchema = z.object({
  path: z.string().default('~/.concept-tracker'),
  format: z.enum(['json', 'sqlite']).default('json'),
});

export type StorageConfig = z.infer<typeof StorageConfigSchema>;

/**
 * API server settings
 */
export const ServerConfigSchema = z.object({
  enabled: z.boolean().default(true),
  port: z.number().default(3001),
  host: z.string().default('localhost'),
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;

/**
 * Dashboard settings
 */
export const DashboardConfigSchema = z.object({
  enabled: z.boolean().default(true),
  port: z.number().default(3000),
  autoOpen: z.boolean().default(false),
});

export type DashboardConfig = z.infer<typeof DashboardConfigSchema>;

/**
 * Complete unified configuration schema
 */
export const UnifiedConfigSchema = z.object({
  version: z.string().default('1.0.0'),
  extraction: ExtractionConfigSchema.default({}),
  storage: StorageConfigSchema.default({}),
  server: ServerConfigSchema.default({}),
  dashboard: DashboardConfigSchema.default({}),
  ides: z.object({
    claudeCode: IDEConfigSchema.optional(),
    cursor: IDEConfigSchema.optional(),
    continue: IDEConfigSchema.optional(),
  }).default({}),
});

export type UnifiedConfig = z.infer<typeof UnifiedConfigSchema>;

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: UnifiedConfig = {
  version: '1.0.0',
  extraction: {
    enabled: true,
    apiProvider: 'deepseek',
    minConversationLength: 100,
    excludePatterns: [],
  },
  storage: {
    path: '~/.concept-tracker',
    format: 'json',
  },
  server: {
    enabled: true,
    port: 3001,
    host: 'localhost',
  },
  dashboard: {
    enabled: true,
    port: 3000,
    autoOpen: false,
  },
  ides: {},
};

/**
 * Parse and validate configuration, filling in defaults
 */
export function parseConfig(data: unknown): UnifiedConfig {
  return UnifiedConfigSchema.parse(data);
}

/**
 * Safely parse configuration with error handling
 */
export function safeParseConfig(data: unknown): { success: true; config: UnifiedConfig } | { success: false; error: string } {
  try {
    const config = parseConfig(data);
    return { success: true, config };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: `Invalid configuration: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown configuration error',
    };
  }
}
