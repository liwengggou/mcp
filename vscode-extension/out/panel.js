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
exports.ConceptTrackerPanel = void 0;
const vscode = __importStar(require("vscode"));
class ConceptTrackerPanel {
    static createOrShow(extensionUri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        // If panel exists, reveal it
        if (ConceptTrackerPanel.currentPanel) {
            ConceptTrackerPanel.currentPanel._panel.reveal(column);
            return;
        }
        // Create new panel
        const panel = vscode.window.createWebviewPanel(ConceptTrackerPanel.viewType, 'Concept Tracker', column || vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [extensionUri]
        });
        ConceptTrackerPanel.currentPanel = new ConceptTrackerPanel(panel, extensionUri);
    }
    constructor(panel, extensionUri) {
        this._disposables = [];
        this._panel = panel;
        this._extensionUri = extensionUri;
        // Set initial content
        this._update();
        // Handle panel disposal
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        // Handle view state changes
        this._panel.onDidChangeViewState(() => {
            if (this._panel.visible) {
                this._update();
            }
        }, null, this._disposables);
    }
    refresh() {
        this._panel.webview.postMessage({ type: 'refresh' });
    }
    _update() {
        this._panel.webview.html = this._getHtmlForWebview();
    }
    _getHtmlForWebview() {
        return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src http://localhost:3000; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
      <title>Concept Tracker</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          overflow: hidden;
          background: var(--vscode-editor-background);
        }
        iframe {
          width: 100%;
          height: 100vh;
          border: none;
        }
        .error-container {
          display: none;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          padding: 40px;
          text-align: center;
          color: var(--vscode-foreground);
          font-family: var(--vscode-font-family);
        }
        .error-container h2 {
          margin-bottom: 16px;
          color: var(--vscode-errorForeground);
        }
        .error-container p {
          margin-bottom: 12px;
          color: var(--vscode-descriptionForeground);
        }
        .error-container code {
          display: block;
          padding: 12px 16px;
          margin: 16px 0;
          background: var(--vscode-textCodeBlock-background);
          border-radius: 4px;
          font-family: var(--vscode-editor-font-family);
        }
        .error-container button {
          padding: 8px 16px;
          margin-top: 16px;
          background: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        .error-container button:hover {
          background: var(--vscode-button-hoverBackground);
        }
      </style>
    </head>
    <body>
      <iframe
        id="dashboard"
        src="http://localhost:3000"
        onload="this.style.display='block'; document.getElementById('error').style.display='none';"
        onerror="handleError()"
      ></iframe>
      <div id="error" class="error-container">
        <h2>Dashboard Not Available</h2>
        <p>Could not connect to the Concept Tracker dashboard.</p>
        <p>Make sure the development servers are running:</p>
        <code>cd concept-tracker && npm run dev:api && npm run dev</code>
        <button onclick="location.reload()">Retry</button>
      </div>
      <script>
        function handleError() {
          document.getElementById('dashboard').style.display = 'none';
          document.getElementById('error').style.display = 'flex';
        }

        // Check connection on load
        setTimeout(() => {
          const iframe = document.getElementById('dashboard');
          try {
            // If we can't access the iframe content, it might have failed
            if (iframe.contentDocument === null) {
              handleError();
            }
          } catch (e) {
            // Cross-origin - this is expected, dashboard loaded
          }
        }, 3000);

        // Handle refresh messages from extension
        window.addEventListener('message', event => {
          if (event.data.type === 'refresh') {
            const iframe = document.getElementById('dashboard');
            iframe.src = iframe.src;
          }
        });
      </script>
    </body>
    </html>`;
    }
    dispose() {
        ConceptTrackerPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}
exports.ConceptTrackerPanel = ConceptTrackerPanel;
ConceptTrackerPanel.viewType = 'conceptTracker.panel';
//# sourceMappingURL=panel.js.map