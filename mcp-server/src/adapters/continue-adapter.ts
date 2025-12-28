import * as fs from 'fs';
import * as path from 'path';
import { BaseAdapter } from './base-adapter.js';
import {
  IDEType,
  IDEInfo,
  ConversationContext,
  HookRegistrationResult,
  ContinueWebhookPayload,
} from './types.js';

/**
 * Adapter for Continue.dev integration
 * Continue.dev is an open-source AI coding assistant that runs as a VS Code extension
 * It uses data destinations (webhooks) instead of traditional hooks
 */
export class ContinueAdapter extends BaseAdapter {
  readonly type: IDEType = 'continue';
  readonly name = 'Continue.dev';
  protected readonly configFileName = 'config.json';
  protected readonly configDirName = '.continue';

  private readonly webhookEndpoint = 'http://localhost:3001/api/extract/continue';

  async detect(): Promise<IDEInfo> {
    const configDir = this.getConfigDir();
    const detected = await this.fileExists(configDir);

    return {
      type: this.type,
      name: this.name,
      version: null,
      configPath: this.getConfigPath(),
      hookSupported: true, // Uses webhooks instead of hooks
      detected,
    };
  }

  async isHookRegistered(): Promise<boolean> {
    // Check config.json for data destination
    const configPath = this.getConfigPath();
    const config = await this.readJsonFile<Record<string, unknown>>(configPath);

    if (config?.analyticsEndpoint === this.webhookEndpoint) {
      return true;
    }

    // Also check for custom data destinations
    if (typeof config?.data === 'object' && config.data !== null) {
      const dataConfig = config.data as Record<string, unknown>;
      if (dataConfig.destination === this.webhookEndpoint) {
        return true;
      }
    }

    return false;
  }

  async registerHook(_hookScriptPath: string): Promise<HookRegistrationResult> {
    // Continue.dev uses webhooks, not scripts
    // We configure the data destination in the config file
    const configPath = this.getConfigPath();

    try {
      // Read existing config or create new
      let config = await this.readJsonFile<Record<string, unknown>>(configPath);
      if (!config) {
        config = {};
      }

      // Check if already configured
      if (config.analyticsEndpoint === this.webhookEndpoint) {
        return {
          success: true,
          message: 'Webhook already configured',
          configPath,
        };
      }

      // Add analytics endpoint (this sends chat data to our API)
      config.analyticsEndpoint = this.webhookEndpoint;

      // Ensure config directory exists
      await fs.promises.mkdir(path.dirname(configPath), { recursive: true });

      // Write back
      await this.writeJsonFile(configPath, config);

      return {
        success: true,
        message: 'Webhook endpoint configured successfully',
        configPath,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to configure webhook: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async unregisterHook(): Promise<HookRegistrationResult> {
    const configPath = this.getConfigPath();

    try {
      const config = await this.readJsonFile<Record<string, unknown>>(configPath);
      if (!config) {
        return {
          success: true,
          message: 'No configuration to update',
          configPath,
        };
      }

      // Remove our endpoint
      if (config.analyticsEndpoint === this.webhookEndpoint) {
        delete config.analyticsEndpoint;
      }

      // Also clean up data.destination if present
      if (typeof config.data === 'object' && config.data !== null) {
        const dataConfig = config.data as Record<string, unknown>;
        if (dataConfig.destination === this.webhookEndpoint) {
          delete dataConfig.destination;
        }
      }

      await this.writeJsonFile(configPath, config);

      return {
        success: true,
        message: 'Webhook endpoint removed successfully',
        configPath,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to remove webhook: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async parseHookInput(input: unknown): Promise<ConversationContext | null> {
    try {
      // Parse as string if needed
      const data = typeof input === 'string' ? JSON.parse(input) : input;
      const parsed = ContinueWebhookPayload.safeParse(data);

      if (!parsed.success) {
        return null;
      }

      // Get messages from either format
      const messages = parsed.data.messages || parsed.data.data?.messages;
      if (!messages || messages.length === 0) {
        return null;
      }

      // Format messages into transcript
      const transcript = messages
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n\n');

      return {
        conversationId: parsed.data.sessionId || 'unknown',
        status: 'completed',
        transcript,
        ide: 'continue',
        timestamp: parsed.data.timestamp || new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  async getTranscript(context: ConversationContext): Promise<string | null> {
    // Continue.dev sends messages directly in the webhook payload
    // which we already parsed into the transcript field
    return context.transcript || null;
  }
}
