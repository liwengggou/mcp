# Concept Tracker

An MCP (Model Context Protocol) server that automatically extracts technical concepts from your AI coding conversations, organizes them into a searchable knowledge base, and links them to your actual codebase.

## Overview

When working with AI coding assistants, you discuss countless technical concepts — libraries, design patterns, language features, architectural decisions. These valuable learning moments get buried in chat history and forgotten.

Concept Tracker captures this knowledge automatically. It hooks into your conversations in real-time, extracts technical concepts, and builds a per-project knowledge base that shows you:

- **What** concepts you've learned and discussed
- **Why** they matter (with explanations)
- **Where** they appear in your code

## Features

### Multi-IDE Support
- **Claude Code**: Native hook integration for automatic extraction
- **Cursor**: Full hook support with stop event handling
- **Continue.dev**: Webhook-based integration
- Universal VS Code extension works across all AI tools

### Real-Time Concept Extraction
- Hooks into AI coding conversations as they happen
- LLM-powered extraction identifies technical concepts automatically
- Captures original chat context for future reference

### Smart Organization
- **Hierarchy**: Concepts organized in parent-child relationships (e.g., "useState" under "React Hooks")
- **Categories**: Language features, libraries/frameworks, design patterns, architectural decisions
- **Deduplication**: Exact name matching prevents duplicate entries

### Codebase Linking
- Real-time scanning on file save
- Finds where each concept appears in your project
- Direct links to specific file locations

### Dual Dashboard
- **IDE Panel**: Quick access without leaving your editor
- **Web App**: Full-featured dashboard for deeper exploration

### Knowledge Management
- Edit concept names and explanations
- Merge similar concepts
- Manual concept addition
- Export to JSON or Markdown
- Notifications when new concepts are extracted

## Concept Structure

Each concept contains:

```json
{
  "id": "uuid",
  "name": "useState",
  "category": "library",
  "parent": "React Hooks",
  "explanation": "A React Hook that lets you add state to functional components...",
  "chatSnippets": [
    {
      "timestamp": "2025-01-15T10:30:00Z",
      "content": "useState returns a pair: the current state value and a function to update it..."
    }
  ],
  "codeLocations": [
    "src/components/Counter.tsx:12",
    "src/hooks/useAuth.ts:8"
  ],
  "firstSeen": "2025-01-15T10:30:00Z",
  "lastSeen": "2025-01-20T14:22:00Z"
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Claude Code                               │
│                            │                                     │
│                      (hooks API)                                 │
│                            ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                 Concept Tracker MCP                      │    │
│  │  ┌───────────────┐  ┌───────────────┐  ┌─────────────┐  │    │
│  │  │   Extractor   │  │   Hierarchy   │  │   Scanner   │  │    │
│  │  │   (LLM)       │  │   Manager     │  │  (Codebase) │  │    │
│  │  └───────────────┘  └───────────────┘  └─────────────┘  │    │
│  │                            │                             │    │
│  │                     ┌──────▼──────┐                      │    │
│  │                     │   Storage   │                      │    │
│  │                     │   (Local)   │                      │    │
│  │                     └─────────────┘                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                            │                                     │
│              ┌─────────────┴─────────────┐                      │
│              ▼                           ▼                       │
│     ┌─────────────────┐        ┌─────────────────┐              │
│     │   IDE Panel     │        │    Web App      │              │
│     │   (VS Code)     │        │   (localhost)   │              │
│     └─────────────────┘        └─────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

## Concept Categories

| Category | Examples |
|----------|----------|
| **Language Features** | async/await, generics, decorators, pattern matching |
| **Libraries & Frameworks** | React hooks, Express middleware, Prisma models |
| **Design Patterns** | Dependency injection, observer pattern, factory pattern |
| **Architecture** | Microservices, event sourcing, CQRS, hexagonal architecture |

## Roadmap

### Phase 1: MVP
- [x] Project setup
- [x] Basic concept extraction (DeepSeek API)
- [x] Local JSON storage
- [x] Simple web dashboard
- [x] Claude Code hook integration (auto-extract on conversation)

### Phase 2: Enhanced Features
- [x] Hierarchy management UI
- [x] Real-time codebase scanning
- [x] VS Code panel integration
- [x] Concept merge/edit functionality
- [x] Export capabilities

### Phase 3: Multi-IDE Support (Current)
- [x] Cursor integration
- [x] Continue.dev integration
- [x] Universal VS Code extension (works with any AI tool)
- [x] Unified configuration system
- [x] IDE adapter abstraction layer

## Tech Stack

- **MCP Server**: TypeScript
- **Storage**: Local JSON/SQLite
- **Web Dashboard**: React + Vite
- **IDE Panel**: VS Code Webview API
- **Code Scanning**: Tree-sitter / ripgrep

## Getting Started

### Prerequisites
- Node.js 18+
- npm 9+
- DeepSeek API key (for concept extraction)

### Installation

```bash
# Clone and enter the project
cd concept-tracker

# Install all dependencies
npm install

# Create your .env file
cp .env.example .env
# Edit .env and add your DEEPSEEK_API_KEY

# Build the MCP server
npm run build

# Run the universal installer (detects and configures all IDEs)
./scripts/install.sh

# Start the servers
npm run dev:api   # API server (port 3001)
npm run dev       # Dashboard (port 3000)
```

### IDE-Specific Installation

If you prefer to install hooks for specific IDEs:

```bash
# Claude Code only
./scripts/install-claude-hook.sh

# Cursor only
./scripts/install-cursor-hook.sh

# Continue.dev only
./scripts/install-continue-hook.sh
```

### Running the Dashboard

```bash
# Development mode with hot reload
npm run dev

# The dashboard will open at http://localhost:3000
```

### Building for Production

```bash
# Build both MCP server and dashboard
npm run build
```

## Configuration

### Remote MCP Setup (Hosted Service)

If you're using a hosted version of Concept Tracker, add this to your Cursor MCP config (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "concept-tracker": {
      "url": "https://your-deployed-url.railway.app/sse?token=YOUR_UNIQUE_TOKEN"
    }
  }
}
```

Replace `YOUR_UNIQUE_TOKEN` with a unique identifier (8-64 alphanumeric characters or dashes). This token isolates your concepts from other users.

### Claude Code MCP Setup

Add to your Claude Code MCP configuration (`~/.claude.json` or project `.claude/settings.json`):

```json
{
  "mcpServers": {
    "concept-tracker": {
      "command": "node",
      "args": ["/path/to/concept-tracker/mcp-server/dist/index.js"],
      "env": {
        "DEEPSEEK_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DEEPSEEK_API_KEY` | Your DeepSeek API key for concept extraction | Yes |
| `STORAGE_PATH` | Custom storage path (default: `~/.concept-tracker`) | No |

## MCP Tools

The Concept Tracker MCP server provides these tools:

| Tool | Description |
|------|-------------|
| `extract_concepts` | Extract technical concepts from conversation text |
| `list_concepts` | List all concepts with optional category/search filters |
| `get_concept` | Get detailed info about a specific concept |
| `add_concept` | Manually add a new concept |
| `update_concept` | Update a concept's name or explanation |
| `delete_concept` | Remove a concept from the knowledge base |

## Deploying to Railway (Self-Hosting)

To host your own public Concept Tracker MCP:

### 1. Prerequisites
- A [Railway](https://railway.app) account
- This repository pushed to GitHub

### 2. Deploy

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project in this directory
railway init

# Link to your project
railway link

# Set your DeepSeek API key
railway variables set DEEPSEEK_API_KEY=your-api-key-here

# Deploy
railway up
```

Or use the Railway dashboard:
1. Create a new project
2. Connect your GitHub repo
3. Add environment variable: `DEEPSEEK_API_KEY`
4. Railway will auto-detect and deploy

### 3. Share with Users

Once deployed, share the URL with users. They'll configure Cursor like this:

```json
{
  "mcpServers": {
    "concept-tracker": {
      "url": "https://YOUR-APP.railway.app/sse?token=their-unique-token"
    }
  }
}
```

Each user should create their own unique token for isolated concept storage.

## License

MIT
