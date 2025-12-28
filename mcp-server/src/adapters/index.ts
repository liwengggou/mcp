import { IDEAdapter, IDEType, IDEInfo } from './types.js';
import { ClaudeCodeAdapter } from './claude-code-adapter.js';
import { CursorAdapter } from './cursor-adapter.js';
import { ContinueAdapter } from './continue-adapter.js';

export * from './types.js';
export { ClaudeCodeAdapter } from './claude-code-adapter.js';
export { CursorAdapter } from './cursor-adapter.js';
export { ContinueAdapter } from './continue-adapter.js';

/**
 * Registry of all available IDE adapters
 */
const adapterRegistry = new Map<IDEType, () => IDEAdapter>([
  ['claude-code', (): IDEAdapter => new ClaudeCodeAdapter()],
  ['cursor', (): IDEAdapter => new CursorAdapter()],
  ['continue', (): IDEAdapter => new ContinueAdapter()],
]);

/**
 * Get an adapter instance for a specific IDE
 */
export function getAdapter(type: IDEType): IDEAdapter | null {
  const factory = adapterRegistry.get(type);
  return factory ? factory() : null;
}

/**
 * Get all available adapter types
 */
export function getAvailableAdapterTypes(): IDEType[] {
  return Array.from(adapterRegistry.keys());
}

/**
 * Create instances of all adapters
 */
export function getAllAdapters(): IDEAdapter[] {
  return Array.from(adapterRegistry.values()).map(factory => factory());
}

/**
 * Detect all installed IDEs
 */
export async function detectInstalledIDEs(): Promise<IDEInfo[]> {
  const adapters = getAllAdapters();
  const results: IDEInfo[] = [];

  for (const adapter of adapters) {
    const info = await adapter.detect();
    if (info.detected) {
      results.push(info);
    }
  }

  return results;
}

/**
 * Detect all IDEs and return full status
 */
export async function getAllIDEStatus(): Promise<Map<IDEType, { info: IDEInfo; hookRegistered: boolean }>> {
  const adapters = getAllAdapters();
  const status = new Map<IDEType, { info: IDEInfo; hookRegistered: boolean }>();

  for (const adapter of adapters) {
    const info = await adapter.detect();
    const hookRegistered = info.detected ? await adapter.isHookRegistered() : false;
    status.set(adapter.type, { info, hookRegistered });
  }

  return status;
}

/**
 * Parse hook input and determine which IDE it came from
 */
export async function parseHookInputFromAnyIDE(input: unknown): Promise<{
  adapter: IDEAdapter;
  context: import('./types.js').ConversationContext;
} | null> {
  const adapters = getAllAdapters();

  for (const adapter of adapters) {
    const context = await adapter.parseHookInput(input);
    if (context) {
      return { adapter, context };
    }
  }

  return null;
}

/**
 * Adapter manager for centralized IDE operations
 */
export class AdapterManager {
  private adapters: Map<IDEType, IDEAdapter> = new Map();

  constructor() {
    for (const type of getAvailableAdapterTypes()) {
      const adapter = getAdapter(type);
      if (adapter) {
        this.adapters.set(type, adapter);
      }
    }
  }

  /**
   * Get a specific adapter
   */
  get(type: IDEType): IDEAdapter | undefined {
    return this.adapters.get(type);
  }

  /**
   * Get all adapters
   */
  getAll(): IDEAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Detect which IDEs are installed
   */
  async detectInstalled(): Promise<IDEInfo[]> {
    const results: IDEInfo[] = [];

    for (const adapter of this.adapters.values()) {
      const info = await adapter.detect();
      if (info.detected) {
        results.push(info);
      }
    }

    return results;
  }

  /**
   * Register hooks for all detected IDEs
   */
  async registerAllHooks(hookBasePath: string): Promise<Map<IDEType, { success: boolean; message: string }>> {
    const results = new Map<IDEType, { success: boolean; message: string }>();

    for (const [type, adapter] of this.adapters) {
      const info = await adapter.detect();
      if (!info.detected) {
        results.set(type, { success: false, message: 'IDE not detected' });
        continue;
      }

      // Construct IDE-specific hook path
      const hookPath = `${hookBasePath}/${type}/on-stop.sh`;
      const result = await adapter.registerHook(hookPath);
      results.set(type, { success: result.success, message: result.message });
    }

    return results;
  }

  /**
   * Unregister hooks for all IDEs
   */
  async unregisterAllHooks(): Promise<Map<IDEType, { success: boolean; message: string }>> {
    const results = new Map<IDEType, { success: boolean; message: string }>();

    for (const [type, adapter] of this.adapters) {
      const result = await adapter.unregisterHook();
      results.set(type, { success: result.success, message: result.message });
    }

    return results;
  }

  /**
   * Get status of all IDEs
   */
  async getStatus(): Promise<Map<IDEType, { detected: boolean; hookRegistered: boolean; name: string }>> {
    const status = new Map<IDEType, { detected: boolean; hookRegistered: boolean; name: string }>();

    for (const [type, adapter] of this.adapters) {
      const info = await adapter.detect();
      const hookRegistered = info.detected ? await adapter.isHookRegistered() : false;
      status.set(type, {
        detected: info.detected,
        hookRegistered,
        name: adapter.name,
      });
    }

    return status;
  }
}

// Singleton instance
let managerInstance: AdapterManager | null = null;

/**
 * Get the singleton adapter manager instance
 */
export function getAdapterManager(): AdapterManager {
  if (!managerInstance) {
    managerInstance = new AdapterManager();
  }
  return managerInstance;
}
