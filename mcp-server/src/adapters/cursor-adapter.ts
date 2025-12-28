import * as fs from 'fs';
import * as path from 'path';
import { BaseAdapter } from './base-adapter.js';
import {
  IDEType,
  IDEInfo,
  ConversationContext,
  HookRegistrationResult,
  CursorHookInput,
} from './types.js';

interface CursorHooks {
  version?: number;
  hooks?: {
    stop?: Array<{ command: string }>;
    beforeSubmitPrompt?: Array<{ command: string }>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Adapter for Cursor IDE integration
 * Cursor is a VS Code fork with AI features
 */
export class CursorAdapter extends BaseAdapter {
  readonly type: IDEType = 'cursor';
  readonly name = 'Cursor';
  protected readonly configFileName = 'hooks.json';
  protected readonly configDirName = '.cursor';

  private readonly hookIdentifier = 'concept-tracker';

  async detect(): Promise<IDEInfo> {
    const baseInfo = await super.detect();

    // Check for Cursor app on macOS
    const cursorAppPath = '/Applications/Cursor.app';
    try {
      await fs.promises.access(cursorAppPath);
      baseInfo.detected = true;
    } catch {
      // App not found, rely on config dir check
    }

    // Check environment variable (when running inside Cursor)
    if (process.env.CURSOR_VERSION) {
      baseInfo.detected = true;
      baseInfo.version = process.env.CURSOR_VERSION;
    }

    return baseInfo;
  }

  async isHookRegistered(): Promise<boolean> {
    const hooks = await this.readJsonFile<CursorHooks>(this.getConfigPath());
    if (!hooks?.hooks?.stop) {
      return false;
    }

    return hooks.hooks.stop.some(hook =>
      hook.command?.includes(this.hookIdentifier)
    );
  }

  async registerHook(hookScriptPath: string): Promise<HookRegistrationResult> {
    const configPath = this.getConfigPath();

    try {
      // Ensure hook script is executable
      await fs.promises.chmod(hookScriptPath, 0o755);

      // Read existing hooks or create new
      let hooks = await this.readJsonFile<CursorHooks>(configPath);
      if (!hooks) {
        hooks = { version: 1 };
      }

      // Initialize hooks structure if needed
      if (!hooks.hooks) {
        hooks.hooks = {};
      }
      if (!hooks.hooks.stop) {
        hooks.hooks.stop = [];
      }

      // Check if already registered
      const alreadyRegistered = hooks.hooks.stop.some(hook =>
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
      hooks.hooks.stop.push({ command: hookScriptPath });

      // Ensure config directory exists
      await fs.promises.mkdir(path.dirname(configPath), { recursive: true });

      // Write back
      await this.writeJsonFile(configPath, hooks);

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
      const hooks = await this.readJsonFile<CursorHooks>(configPath);
      if (!hooks?.hooks?.stop) {
        return {
          success: true,
          message: 'No hooks to unregister',
          configPath,
        };
      }

      // Filter out our hook
      hooks.hooks.stop = hooks.hooks.stop.filter(hook =>
        !hook.command?.includes(this.hookIdentifier)
      );

      // Clean up empty arrays
      if (hooks.hooks.stop.length === 0) {
        delete hooks.hooks.stop;
      }
      if (Object.keys(hooks.hooks).length === 0) {
        delete hooks.hooks;
      }

      await this.writeJsonFile(configPath, hooks);

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
      const parsed = CursorHookInput.safeParse(data);

      if (!parsed.success) {
        return null;
      }

      return {
        conversationId: parsed.data.conversation_id,
        status: parsed.data.status,
        workspaceRoots: parsed.data.workspace_roots,
        ide: 'cursor',
        timestamp: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  async getTranscript(context: ConversationContext): Promise<string | null> {
    // Cursor doesn't provide transcript directly in hook input
    // We return the transcript if it was provided in context (e.g., from API request body)
    // or null if we need to fetch it another way
    return context.transcript || null;
  }
}
