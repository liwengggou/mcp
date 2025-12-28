import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { UnifiedConfig, DEFAULT_CONFIG, parseConfig, safeParseConfig } from './schema.js';

/**
 * Configuration manager for the unified Concept Tracker configuration
 */
export class ConfigManager {
  private config: UnifiedConfig;
  private configPath: string;
  private projectConfigPath: string | null = null;

  constructor(projectRoot?: string) {
    this.configPath = this.getGlobalConfigPath();

    if (projectRoot) {
      this.projectConfigPath = path.join(projectRoot, '.concept-tracker', 'config.json');
    }

    this.config = this.loadConfig();
  }

  /**
   * Get the global config directory path
   */
  private getConfigDir(): string {
    return path.join(os.homedir(), '.concept-tracker');
  }

  /**
   * Get the global config file path
   */
  private getGlobalConfigPath(): string {
    return path.join(this.getConfigDir(), 'config.json');
  }

  /**
   * Expand ~ to home directory
   */
  private expandPath(p: string): string {
    if (p.startsWith('~/')) {
      return path.join(os.homedir(), p.slice(2));
    }
    return p;
  }

  /**
   * Load configuration from file, merging with defaults
   */
  private loadConfig(): UnifiedConfig {
    // Start with defaults
    let config = { ...DEFAULT_CONFIG };

    // Load global config if exists
    const globalConfig = this.readConfigFile(this.configPath);
    if (globalConfig) {
      config = this.mergeConfigs(config, globalConfig);
    }

    // Load project config if exists (overrides global)
    if (this.projectConfigPath) {
      const projectConfig = this.readConfigFile(this.projectConfigPath);
      if (projectConfig) {
        config = this.mergeConfigs(config, projectConfig);
      }
    }

    return config;
  }

  /**
   * Read and parse a config file
   */
  private readConfigFile(filePath: string): Partial<UnifiedConfig> | null {
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      const result = safeParseConfig(data);

      if (result.success) {
        return result.config;
      }

      console.warn(`Warning: Invalid config at ${filePath}: ${result.error}`);
      return null;
    } catch (error) {
      console.warn(`Warning: Could not read config at ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Deep merge two configs
   */
  private mergeConfigs(base: UnifiedConfig, override: Partial<UnifiedConfig>): UnifiedConfig {
    return {
      ...base,
      ...override,
      extraction: { ...base.extraction, ...override.extraction },
      storage: { ...base.storage, ...override.storage },
      server: { ...base.server, ...override.server },
      dashboard: { ...base.dashboard, ...override.dashboard },
      ides: { ...base.ides, ...override.ides },
    };
  }

  /**
   * Get the current configuration
   */
  getConfig(): UnifiedConfig {
    return this.config;
  }

  /**
   * Get a specific section of the configuration
   */
  get<K extends keyof UnifiedConfig>(key: K): UnifiedConfig[K] {
    return this.config[key];
  }

  /**
   * Update configuration
   */
  async update(updates: Partial<UnifiedConfig>): Promise<void> {
    this.config = this.mergeConfigs(this.config, updates);
    await this.save();
  }

  /**
   * Update a specific section
   */
  async updateSection<K extends keyof UnifiedConfig>(
    key: K,
    updates: Partial<UnifiedConfig[K]>
  ): Promise<void> {
    // @ts-expect-error - TypeScript can't infer the correct type here
    this.config[key] = { ...this.config[key], ...updates };
    await this.save();
  }

  /**
   * Save configuration to file
   */
  async save(toProject = false): Promise<void> {
    const filePath = toProject && this.projectConfigPath ? this.projectConfigPath : this.configPath;
    const dir = path.dirname(filePath);

    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(filePath, JSON.stringify(this.config, null, 2));
  }

  /**
   * Initialize configuration file if it doesn't exist
   */
  async initialize(): Promise<boolean> {
    if (fs.existsSync(this.configPath)) {
      return false;
    }

    await this.save();
    return true;
  }

  /**
   * Reload configuration from disk
   */
  reload(): void {
    this.config = this.loadConfig();
  }

  /**
   * Get the expanded storage path
   */
  getStoragePath(): string {
    return this.expandPath(this.config.storage.path);
  }

  /**
   * Get the API server URL
   */
  getServerUrl(): string {
    const { host, port } = this.config.server;
    return `http://${host}:${port}`;
  }

  /**
   * Get the dashboard URL
   */
  getDashboardUrl(): string {
    const { port } = this.config.dashboard;
    return `http://localhost:${port}`;
  }

  /**
   * Check if extraction is enabled
   */
  isExtractionEnabled(): boolean {
    return this.config.extraction.enabled;
  }

  /**
   * Get IDE-specific configuration
   */
  getIDEConfig(ide: 'claudeCode' | 'cursor' | 'continue'): {
    enabled: boolean;
    hookPath?: string;
    autoRegister: boolean;
  } {
    const ideConfig = this.config.ides[ide];
    return {
      enabled: ideConfig?.enabled ?? true,
      hookPath: ideConfig?.hookPath,
      autoRegister: ideConfig?.autoRegister ?? true,
    };
  }

  /**
   * Update IDE-specific configuration
   */
  async updateIDEConfig(
    ide: 'claudeCode' | 'cursor' | 'continue',
    updates: Partial<{
      enabled: boolean;
      hookPath: string;
      autoRegister: boolean;
    }>
  ): Promise<void> {
    this.config.ides[ide] = {
      ...this.config.ides[ide],
      enabled: updates.enabled ?? this.config.ides[ide]?.enabled ?? true,
      hookPath: updates.hookPath ?? this.config.ides[ide]?.hookPath,
      autoRegister: updates.autoRegister ?? this.config.ides[ide]?.autoRegister ?? true,
    };
    await this.save();
  }

  /**
   * Get the config file path
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Validate configuration
   */
  validate(): { valid: boolean; errors: string[] } {
    const result = safeParseConfig(this.config);
    if (result.success) {
      return { valid: true, errors: [] };
    }
    return { valid: false, errors: [result.error] };
  }
}

// Singleton instance
let managerInstance: ConfigManager | null = null;

/**
 * Get the singleton config manager instance
 */
export function getConfigManager(projectRoot?: string): ConfigManager {
  if (!managerInstance) {
    managerInstance = new ConfigManager(projectRoot);
  }
  return managerInstance;
}

/**
 * Reset the singleton (useful for testing)
 */
export function resetConfigManager(): void {
  managerInstance = null;
}
