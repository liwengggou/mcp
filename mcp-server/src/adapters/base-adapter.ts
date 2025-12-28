import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { IDEAdapter, IDEType, IDEInfo, ConversationContext, HookRegistrationResult } from './types.js';

/**
 * Abstract base class for IDE adapters providing common functionality
 */
export abstract class BaseAdapter implements IDEAdapter {
  abstract readonly type: IDEType;
  abstract readonly name: string;
  protected abstract readonly configFileName: string;
  protected abstract readonly configDirName: string;

  /**
   * Get the home directory
   */
  protected getHomeDir(): string {
    return os.homedir();
  }

  /**
   * Check if a file exists
   */
  protected async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Read JSON file safely
   */
  protected async readJsonFile<T>(filePath: string): Promise<T | null> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(content) as T;
    } catch {
      return null;
    }
  }

  /**
   * Write JSON file with pretty formatting
   */
  protected async writeJsonFile(filePath: string, data: unknown): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  /**
   * Read file content safely
   */
  protected async readFile(filePath: string): Promise<string | null> {
    try {
      return await fs.promises.readFile(filePath, 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * Get the config directory path
   */
  protected getConfigDir(): string {
    return path.join(this.getHomeDir(), this.configDirName);
  }

  /**
   * Get the full config file path
   */
  getConfigPath(): string {
    return path.join(this.getConfigDir(), this.configFileName);
  }

  /**
   * Default detection checks if config directory exists
   */
  async detect(): Promise<IDEInfo> {
    const configDir = this.getConfigDir();
    const detected = await this.fileExists(configDir);

    return {
      type: this.type,
      name: this.name,
      version: null,
      configPath: this.getConfigPath(),
      hookSupported: true,
      detected,
    };
  }

  /**
   * Abstract methods to be implemented by subclasses
   */
  abstract isHookRegistered(): Promise<boolean>;
  abstract registerHook(hookScriptPath: string): Promise<HookRegistrationResult>;
  abstract unregisterHook(): Promise<HookRegistrationResult>;
  abstract parseHookInput(input: unknown): Promise<ConversationContext | null>;
  abstract getTranscript(context: ConversationContext): Promise<string | null>;
}
