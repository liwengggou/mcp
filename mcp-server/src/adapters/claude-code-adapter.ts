import * as fs from 'fs';
import { BaseAdapter } from './base-adapter.js';
import {
  IDEType,
  IDEInfo,
  ConversationContext,
  HookRegistrationResult,
  ClaudeCodeHookInput,
} from './types.js';

interface ClaudeSettings {
  hooks?: {
    Stop?: Array<{ command: string }>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Adapter for Claude Code IDE integration
 */
export class ClaudeCodeAdapter extends BaseAdapter {
  readonly type: IDEType = 'claude-code';
  readonly name = 'Claude Code';
  protected readonly configFileName = 'settings.json';
  protected readonly configDirName = '.claude';

  private readonly hookIdentifier = 'concept-tracker';

  async detect(): Promise<IDEInfo> {
    const baseInfo = await super.detect();

    // Also check for claude CLI
    try {
      const { execSync } = await import('child_process');
      execSync('which claude', { stdio: 'ignore' });
      baseInfo.detected = true;
    } catch {
      // CLI not found, rely on config dir check
    }

    return baseInfo;
  }

  async isHookRegistered(): Promise<boolean> {
    const settings = await this.readJsonFile<ClaudeSettings>(this.getConfigPath());
    if (!settings?.hooks?.Stop) {
      return false;
    }

    return settings.hooks.Stop.some(hook =>
      hook.command?.includes(this.hookIdentifier)
    );
  }

  async registerHook(hookScriptPath: string): Promise<HookRegistrationResult> {
    const configPath = this.getConfigPath();

    try {
      // Ensure hook script is executable
      await fs.promises.chmod(hookScriptPath, 0o755);

      // Read existing settings or create new
      let settings = await this.readJsonFile<ClaudeSettings>(configPath);
      if (!settings) {
        settings = {};
      }

      // Initialize hooks structure if needed
      if (!settings.hooks) {
        settings.hooks = {};
      }
      if (!settings.hooks.Stop) {
        settings.hooks.Stop = [];
      }

      // Check if already registered
      const alreadyRegistered = settings.hooks.Stop.some(hook =>
        hook.command?.includes(this.hookIdentifier)
      );

      if (alreadyRegistered) {
        return {
          success: true,
          message: 'Hook already registered',
          configPath,
        };
      }

      // Add the hook
      settings.hooks.Stop.push({ command: hookScriptPath });

      // Write back
      await this.writeJsonFile(configPath, settings);

      return {
        success: true,
        message: 'Hook registered successfully',
        configPath,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to register hook: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async unregisterHook(): Promise<HookRegistrationResult> {
    const configPath = this.getConfigPath();

    try {
      const settings = await this.readJsonFile<ClaudeSettings>(configPath);
      if (!settings?.hooks?.Stop) {
        return {
          success: true,
          message: 'No hooks to unregister',
          configPath,
        };
      }

      // Filter out our hook
      settings.hooks.Stop = settings.hooks.Stop.filter(hook =>
        !hook.command?.includes(this.hookIdentifier)
      );

      // Clean up empty arrays
      if (settings.hooks.Stop.length === 0) {
        delete settings.hooks.Stop;
      }
      if (Object.keys(settings.hooks).length === 0) {
        delete settings.hooks;
      }

      await this.writeJsonFile(configPath, settings);

      return {
        success: true,
        message: 'Hook unregistered successfully',
        configPath,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to unregister hook: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async parseHookInput(input: unknown): Promise<ConversationContext | null> {
    try {
      // Parse as string if needed
      const data = typeof input === 'string' ? JSON.parse(input) : input;
      const parsed = ClaudeCodeHookInput.safeParse(data);

      if (!parsed.success) {
        return null;
      }

      return {
        conversationId: parsed.data.conversation_id || 'unknown',
        sessionId: parsed.data.session_id,
        status: 'completed',
        transcriptPath: parsed.data.transcript_path,
        ide: 'claude-code',
        timestamp: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  async getTranscript(context: ConversationContext): Promise<string | null> {
    if (!context.transcriptPath) {
      return context.transcript || null;
    }

    try {
      const content = await this.readFile(context.transcriptPath);
      if (!content) {
        return null;
      }

      // Parse JSONL transcript and extract conversation
      const lines = content.split('\n').filter(line => line.trim());
      const messages: string[] = [];

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);

          if (entry.type === 'user' && entry.message) {
            messages.push(`User: ${entry.message}`);
          } else if (entry.type === 'assistant' && entry.message) {
            messages.push(`Assistant: ${entry.message}`);
          }
        } catch {
          // Skip invalid lines
        }
      }

      if (messages.length === 0) {
        return null;
      }

      // Limit to last 2000 characters
      const transcript = messages.join('\n\n');
      return transcript.length > 2000 ? transcript.slice(-2000) : transcript;
    } catch {
      return null;
    }
  }
}
