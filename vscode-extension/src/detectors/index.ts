import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface AIToolInfo {
  id: string;
  name: string;
  detected: boolean;
  version: string | null;
  configPath: string | null;
}

export interface AIToolDetector {
  id: string;
  name: string;
  detect(): Promise<boolean>;
  getVersion(): Promise<string | null>;
  getConfigPath(): string | null;
}

/**
 * Claude Code detector
 */
export class ClaudeCodeDetector implements AIToolDetector {
  id = 'claude-code';
  name = 'Claude Code';

  async detect(): Promise<boolean> {
    // Check for .claude directory
    const claudeDir = path.join(os.homedir(), '.claude');
    if (fs.existsSync(claudeDir)) {
      return true;
    }

    // Check for claude CLI
    try {
      const { exec } = await import('child_process');
      return await new Promise((resolve) => {
        exec('which claude', (error) => {
          resolve(!error);
        });
      });
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<string | null> {
    try {
      const { exec } = await import('child_process');
      return await new Promise((resolve) => {
        exec('claude --version', (error, stdout) => {
          if (error) {
            resolve(null);
          } else {
            resolve(stdout.trim());
          }
        });
      });
    } catch {
      return null;
    }
  }

  getConfigPath(): string | null {
    return path.join(os.homedir(), '.claude', 'settings.json');
  }
}

/**
 * Cursor detector
 */
export class CursorDetector implements AIToolDetector {
  id = 'cursor';
  name = 'Cursor';

  async detect(): Promise<boolean> {
    // Check if running inside Cursor
    const appName = vscode.env.appName.toLowerCase();
    if (appName.includes('cursor')) {
      return true;
    }

    // Check for Cursor environment variable
    if (process.env.CURSOR_VERSION) {
      return true;
    }

    // Check for Cursor config directory
    const cursorDir = path.join(os.homedir(), '.cursor');
    if (fs.existsSync(cursorDir)) {
      return true;
    }

    // Check for Cursor app on macOS
    if (process.platform === 'darwin') {
      return fs.existsSync('/Applications/Cursor.app');
    }

    return false;
  }

  async getVersion(): Promise<string | null> {
    if (process.env.CURSOR_VERSION) {
      return process.env.CURSOR_VERSION;
    }

    // If running inside Cursor, use VS Code version
    const appName = vscode.env.appName.toLowerCase();
    if (appName.includes('cursor')) {
      return vscode.version;
    }

    return null;
  }

  getConfigPath(): string | null {
    return path.join(os.homedir(), '.cursor', 'hooks.json');
  }
}

/**
 * Continue.dev detector
 */
export class ContinueDetector implements AIToolDetector {
  id = 'continue';
  name = 'Continue.dev';

  async detect(): Promise<boolean> {
    // Check if Continue.dev extension is installed
    const continueExt = vscode.extensions.getExtension('Continue.continue');
    if (continueExt) {
      return true;
    }

    // Check for Continue config directory
    const continueDir = path.join(os.homedir(), '.continue');
    if (fs.existsSync(continueDir)) {
      return true;
    }

    return false;
  }

  async getVersion(): Promise<string | null> {
    const ext = vscode.extensions.getExtension('Continue.continue');
    return ext?.packageJSON?.version || null;
  }

  getConfigPath(): string | null {
    return path.join(os.homedir(), '.continue', 'config.json');
  }
}

/**
 * Get all available detectors
 */
export function getAllDetectors(): AIToolDetector[] {
  return [
    new ClaudeCodeDetector(),
    new CursorDetector(),
    new ContinueDetector(),
  ];
}

/**
 * Detect all installed AI tools
 */
export async function detectInstalledAITools(): Promise<AIToolInfo[]> {
  const detectors = getAllDetectors();
  const results: AIToolInfo[] = [];

  for (const detector of detectors) {
    const detected = await detector.detect();
    results.push({
      id: detector.id,
      name: detector.name,
      detected,
      version: detected ? await detector.getVersion() : null,
      configPath: detector.getConfigPath(),
    });
  }

  return results;
}

/**
 * Get only detected AI tools
 */
export async function getDetectedAITools(): Promise<AIToolInfo[]> {
  const allTools = await detectInstalledAITools();
  return allTools.filter(tool => tool.detected);
}
