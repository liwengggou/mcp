import { z } from 'zod';

/**
 * Supported IDE types
 */
export type IDEType = 'claude-code' | 'cursor' | 'continue';

/**
 * Information about an IDE installation
 */
export interface IDEInfo {
  type: IDEType;
  name: string;
  version: string | null;
  configPath: string;
  hookSupported: boolean;
  detected: boolean;
}

/**
 * Context from a conversation event
 */
export interface ConversationContext {
  conversationId: string;
  sessionId?: string;
  status: 'completed' | 'aborted' | 'error' | 'unknown';
  transcript?: string;
  transcriptPath?: string;
  workspaceRoots?: string[];
  ide: IDEType;
  timestamp: string;
}

/**
 * Hook input from Claude Code
 */
export const ClaudeCodeHookInput = z.object({
  transcript_path: z.string().optional(),
  session_id: z.string().optional(),
  conversation_id: z.string().optional(),
});

export type ClaudeCodeHookInput = z.infer<typeof ClaudeCodeHookInput>;

/**
 * Hook input from Cursor
 */
export const CursorHookInput = z.object({
  conversation_id: z.string(),
  generation_id: z.string().optional(),
  status: z.enum(['completed', 'aborted', 'error']),
  workspace_roots: z.array(z.string()).optional(),
});

export type CursorHookInput = z.infer<typeof CursorHookInput>;

/**
 * Webhook payload from Continue.dev
 */
export const ContinueWebhookPayload = z.object({
  type: z.string().optional(),
  sessionId: z.string().optional(),
  timestamp: z.string().optional(),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
  })).optional(),
  // Legacy format support
  data: z.object({
    messages: z.array(z.object({
      role: z.string(),
      content: z.string(),
    })).optional(),
  }).optional(),
});

export type ContinueWebhookPayload = z.infer<typeof ContinueWebhookPayload>;

/**
 * IDE-specific configuration within unified config
 */
export interface IDESpecificConfig {
  enabled: boolean;
  hookPath?: string;
  autoRegister?: boolean;
}

/**
 * Result from hook registration
 */
export interface HookRegistrationResult {
  success: boolean;
  message: string;
  configPath?: string;
}

/**
 * Interface that all IDE adapters must implement
 */
export interface IDEAdapter {
  readonly type: IDEType;
  readonly name: string;

  /**
   * Check if this IDE is installed/available
   */
  detect(): Promise<IDEInfo>;

  /**
   * Get the IDE's configuration file path
   */
  getConfigPath(): string;

  /**
   * Check if hooks are currently registered
   */
  isHookRegistered(): Promise<boolean>;

  /**
   * Register the concept extraction hook
   */
  registerHook(hookScriptPath: string): Promise<HookRegistrationResult>;

  /**
   * Unregister the concept extraction hook
   */
  unregisterHook(): Promise<HookRegistrationResult>;

  /**
   * Parse hook input into normalized ConversationContext
   */
  parseHookInput(input: unknown): Promise<ConversationContext | null>;

  /**
   * Get transcript content from conversation context
   */
  getTranscript(context: ConversationContext): Promise<string | null>;
}
