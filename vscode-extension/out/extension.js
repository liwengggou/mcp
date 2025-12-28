"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const panel_1 = require("./panel");
function activate(context) {
    console.log('Concept Tracker extension is now active');
    // Register command to open panel
    context.subscriptions.push(vscode.commands.registerCommand('conceptTracker.openPanel', () => {
        panel_1.ConceptTrackerPanel.createOrShow(context.extensionUri);
    }));
    // Register command to scan workspace
    context.subscriptions.push(vscode.commands.registerCommand('conceptTracker.scanWorkspace', async () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }
        try {
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Scanning workspace for concepts...',
                cancellable: false
            }, async () => {
                const response = await fetch('http://localhost:3001/api/scan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ rootPath: workspaceFolder.uri.fsPath })
                });
                const result = await response.json();
                if (result.success) {
                    vscode.window.showInformationMessage(`Scan complete! Found matches in ${result.data?.matchedConcepts || 0} concept(s).`);
                    // Refresh panel if open
                    panel_1.ConceptTrackerPanel.currentPanel?.refresh();
                }
                else {
                    vscode.window.showErrorMessage(result.error || 'Scan failed');
                }
            });
        }
        catch (error) {
            vscode.window.showErrorMessage('Failed to connect to Concept Tracker API. Make sure the server is running (npm run dev:api).');
        }
    }));
    // Register webview provider for sidebar
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('conceptTracker.dashboard', new ConceptTrackerViewProvider(context.extensionUri)));
}
class ConceptTrackerViewProvider {
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
    }
    resolveWebviewView(webviewView, _context, _token) {
        webviewView.webview.options = {
            enableScripts: true
        };
        webviewView.webview.html = this._getHtml();
    }
    _getHtml() {
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
function deactivate() { }
//# sourceMappingURL=extension.js.map