import * as vscode from 'vscode';
import { ConceptTrackerPanel } from './panel';
import { detectInstalledAITools, getDetectedAITools } from './detectors';

// Configuration
const API_URL = 'http://localhost:3001';

export function activate(context: vscode.ExtensionContext) {
  console.log('Concept Tracker extension is now active');

  // Register command to open panel
  context.subscriptions.push(
    vscode.commands.registerCommand('conceptTracker.openPanel', () => {
      ConceptTrackerPanel.createOrShow(context.extensionUri);
    })
  );

  // Register command to scan workspace
  context.subscriptions.push(
    vscode.commands.registerCommand('conceptTracker.scanWorkspace', async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
      }

      try {
        vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Scanning workspace for concepts...',
            cancellable: false
          },
          async () => {
            const response = await fetch(`${API_URL}/api/scan`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ rootPath: workspaceFolder.uri.fsPath })
            });

            const result = await response.json() as { success: boolean; data?: { matchedConcepts: number }; error?: string };

            if (result.success) {
              vscode.window.showInformationMessage(
                `Scan complete! Found matches in ${result.data?.matchedConcepts || 0} concept(s).`
              );
              // Refresh panel if open
              ConceptTrackerPanel.currentPanel?.refresh();
            } else {
              vscode.window.showErrorMessage(result.error || 'Scan failed');
            }
          }
        );
      } catch {
        vscode.window.showErrorMessage(
          'Failed to connect to Concept Tracker API. Make sure the server is running (npm run dev:api).'
        );
      }
    })
  );

  // Register command to detect installed AI tools
  context.subscriptions.push(
    vscode.commands.registerCommand('conceptTracker.detectIDEs', async () => {
      const tools = await detectInstalledAITools();
      const detected = tools.filter(t => t.detected);

      if (detected.length === 0) {
        vscode.window.showInformationMessage('No supported AI tools detected.');
        return;
      }

      const items = detected.map(tool => ({
        label: `$(check) ${tool.name}`,
        description: tool.version || 'Version unknown',
        detail: tool.configPath || undefined,
      }));

      await vscode.window.showQuickPick(items, {
        title: 'Detected AI Tools',
        placeHolder: 'These AI tools were found on your system',
      });
    })
  );

  // Register command to setup IDE integration
  context.subscriptions.push(
    vscode.commands.registerCommand('conceptTracker.setupIDE', async () => {
      await runSetupWizard();
    })
  );

  // Register command to extract concepts from selection
  context.subscriptions.push(
    vscode.commands.registerCommand('conceptTracker.extractFromSelection', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      const selection = editor.selection;
      const text = editor.document.getText(selection);

      if (!text || text.trim().length < 50) {
        vscode.window.showWarningMessage('Please select at least 50 characters of text to extract concepts from.');
        return;
      }

      try {
        vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Extracting concepts...',
            cancellable: false
          },
          async () => {
            const response = await fetch(`${API_URL}/api/extract`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text, saveContext: true })
            });

            const result = await response.json() as {
              success: boolean;
              data?: { concepts: unknown[]; message: string };
              error?: string
            };

            if (result.success) {
              const count = result.data?.concepts?.length || 0;
              if (count > 0) {
                vscode.window.showInformationMessage(
                  `Extracted ${count} concept(s) from selection.`
                );
                ConceptTrackerPanel.currentPanel?.refresh();
              } else {
                vscode.window.showInformationMessage('No technical concepts found in selection.');
              }
            } else {
              vscode.window.showErrorMessage(result.error || 'Extraction failed');
            }
          }
        );
      } catch {
        vscode.window.showErrorMessage(
          'Failed to connect to Concept Tracker API. Make sure the server is running.'
        );
      }
    })
  );

  // Register webview provider for sidebar
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'conceptTracker.dashboard',
      new ConceptTrackerViewProvider(context.extensionUri)
    )
  );

  // Register tree view for IDE status
  const ideStatusProvider = new IDEStatusProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('conceptTracker.ideStatus', ideStatusProvider)
  );

  // Refresh IDE status command
  context.subscriptions.push(
    vscode.commands.registerCommand('conceptTracker.refreshIDEStatus', () => {
      ideStatusProvider.refresh();
    })
  );

  // Auto-detect on activation
  detectAndNotify();
}

async function detectAndNotify() {
  const detected = await getDetectedAITools();
  if (detected.length > 0) {
    const names = detected.map(t => t.name).join(', ');
    console.log(`Concept Tracker: Detected AI tools: ${names}`);
  }
}

async function runSetupWizard() {
  // Step 1: Detect AI tools
  const tools = await detectInstalledAITools();
  const detected = tools.filter(t => t.detected);

  if (detected.length === 0) {
    vscode.window.showWarningMessage(
      'No supported AI tools detected. Concept Tracker supports Claude Code, Cursor, and Continue.dev.'
    );
    return;
  }

  // Step 2: Let user select which tools to configure
  const items = detected.map(tool => ({
    label: tool.name,
    description: tool.version || '',
    picked: true,
    tool,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    title: 'Setup Concept Tracker',
    placeHolder: 'Select AI tools to configure for concept extraction',
    canPickMany: true,
  });

  if (!selected || selected.length === 0) {
    return;
  }

  // Step 3: Register hooks via API
  try {
    const hookBasePath = await getHookBasePath();

    const response = await fetch(`${API_URL}/api/ides/register-hooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hookBasePath })
    });

    const result = await response.json() as {
      success: boolean;
      data?: { results: Record<string, { success: boolean; message: string }> };
      error?: string
    };

    if (result.success && result.data) {
      const successes: string[] = [];
      const failures: string[] = [];

      for (const [ide, status] of Object.entries(result.data.results)) {
        if (status.success) {
          successes.push(ide);
        } else {
          failures.push(`${ide}: ${status.message}`);
        }
      }

      if (successes.length > 0) {
        vscode.window.showInformationMessage(
          `Successfully configured: ${successes.join(', ')}`
        );
      }

      if (failures.length > 0) {
        vscode.window.showWarningMessage(
          `Some configurations failed:\n${failures.join('\n')}`
        );
      }
    } else {
      vscode.window.showErrorMessage(result.error || 'Setup failed');
    }
  } catch {
    vscode.window.showErrorMessage(
      'Failed to connect to Concept Tracker API. Make sure the server is running (npm run dev:api).'
    );
  }
}

async function getHookBasePath(): Promise<string> {
  // Try to find the concept-tracker hooks directory
  const extensionPath = vscode.extensions.getExtension('concept-tracker.concept-tracker')?.extensionPath;

  if (extensionPath) {
    return `${extensionPath}/../hooks`;
  }

  // Default to user's home directory
  const os = await import('os');
  return `${os.homedir()}/.concept-tracker/hooks`;
}

class ConceptTrackerViewProvider implements vscode.WebviewViewProvider {
  constructor(private readonly _extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    webviewView.webview.options = {
      enableScripts: true
    };

    webviewView.webview.html = this._getHtml();
  }

  private _getHtml(): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          margin: 0;
          padding: 10px;
          font-family: var(--vscode-font-family);
          font-size: var(--vscode-font-size);
          color: var(--vscode-foreground);
        }
        iframe {
          width: 100%;
          height: calc(100vh - 80px);
          border: 1px solid var(--vscode-panel-border);
          border-radius: 4px;
        }
        .header {
          margin-bottom: 10px;
        }
        .header h3 {
          margin: 0 0 5px 0;
          font-size: 14px;
        }
        .header p {
          margin: 0;
          font-size: 12px;
          color: var(--vscode-descriptionForeground);
        }
        .error {
          padding: 20px;
          text-align: center;
          color: var(--vscode-errorForeground);
        }
        .error a {
          color: var(--vscode-textLink-foreground);
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h3>Concept Tracker</h3>
        <p>Knowledge from AI conversations</p>
      </div>
      <iframe
        src="http://localhost:3000"
        onload="this.style.display='block'"
        onerror="this.style.display='none'; document.getElementById('error').style.display='block';"
      ></iframe>
      <div id="error" class="error" style="display:none;">
        <p>Could not connect to dashboard.</p>
        <p>Make sure the dashboard is running:</p>
        <code>npm run dev</code>
      </div>
    </body>
    </html>`;
  }
}

class IDEStatusProvider implements vscode.TreeDataProvider<IDEStatusItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<IDEStatusItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: IDEStatusItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<IDEStatusItem[]> {
    try {
      const response = await fetch(`${API_URL}/api/health/ides`);
      const result = await response.json() as {
        success: boolean;
        data?: {
          ides: Record<string, { detected: boolean; hookRegistered: boolean; name: string }>
        }
      };

      if (!result.success || !result.data) {
        return [new IDEStatusItem('API not available', 'error', 'Run: npm run dev:api')];
      }

      const items: IDEStatusItem[] = [];

      for (const [_id, info] of Object.entries(result.data.ides)) {
        let status: 'active' | 'detected' | 'not-detected';
        let description: string;

        if (info.detected && info.hookRegistered) {
          status = 'active';
          description = 'Hook registered';
        } else if (info.detected) {
          status = 'detected';
          description = 'Detected - hook not registered';
        } else {
          status = 'not-detected';
          description = 'Not detected';
        }

        items.push(new IDEStatusItem(info.name, status, description));
      }

      return items;
    } catch {
      return [new IDEStatusItem('API not available', 'error', 'Run: npm run dev:api')];
    }
  }
}

class IDEStatusItem extends vscode.TreeItem {
  constructor(
    public readonly name: string,
    public readonly status: 'active' | 'detected' | 'not-detected' | 'error',
    public readonly description: string
  ) {
    super(name, vscode.TreeItemCollapsibleState.None);
    this.tooltip = description;

    switch (status) {
      case 'active':
        this.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
        break;
      case 'detected':
        this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.yellow'));
        break;
      case 'not-detected':
        this.iconPath = new vscode.ThemeIcon('circle-outline');
        break;
      case 'error':
        this.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
        break;
    }
  }
}

export function deactivate() {}
