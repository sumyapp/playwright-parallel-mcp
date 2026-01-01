# playwright-parallel-mcp

[![CI](https://github.com/sumyapp/playwright-parallel-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/sumyapp/playwright-parallel-mcp/actions/workflows/ci.yml)
[![Coverage Status](https://coveralls.io/repos/github/sumyapp/playwright-parallel-mcp/badge.svg?branch=main)](https://coveralls.io/github/sumyapp/playwright-parallel-mcp?branch=main)
[![npm version](https://badge.fury.io/js/playwright-parallel-mcp.svg)](https://www.npmjs.com/package/playwright-parallel-mcp)

**[English](README.md)** | [日本語](README.ja.md) | [中文](README.zh.md)

A Model Context Protocol (MCP) server that enables AI agents to control **multiple independent browser instances** in parallel.

## The Problem

Existing browser automation MCP servers (Chrome DevTools MCP, Playwright MCP) share a single browser instance across all sessions, causing conflicts when multiple AI agents try to use them simultaneously.

## The Solution

playwright-parallel-mcp creates **isolated browser instances for each session** by spawning independent MCP backend processes, enabling true parallel browser automation.

## Architecture (v0.3.0+)

playwright-parallel-mcp uses a **wrapper architecture** that spawns child MCP server processes for each session:

```
┌─────────────────────────────────────────────────────────────────┐
│              playwright-parallel-mcp (Wrapper)                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Session Manager                                         │    │
│  │  - Session lifecycle management                          │    │
│  │  - Tool routing with sessionId                           │    │
│  │  - Automatic cleanup                                     │    │
│  └─────────────────────────────────────────────────────────┘    │
└───────────────┬─────────────────────┬─────────────────────┬─────┘
                │                     │                     │
                ▼                     ▼                     ▼
    ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐
    │  Session A        │ │  Session B        │ │  Session C        │
    │  ┌─────────────┐  │ │  ┌─────────────┐  │ │  ┌─────────────┐  │
    │  │ MCP Backend │  │ │  │ MCP Backend │  │ │  │ MCP Backend │  │
    │  │ (Child      │  │ │  │ (Child      │  │ │  │ (Child      │  │
    │  │  Process)   │  │ │  │  Process)   │  │ │  │  Process)   │  │
    │  └──────┬──────┘  │ │  └──────┬──────┘  │ │  └──────┬──────┘  │
    │         │         │ │         │         │ │         │         │
    │         ▼         │ │         ▼         │ │         ▼         │
    │  ┌─────────────┐  │ │  ┌─────────────┐  │ │  ┌─────────────┐  │
    │  │  Browser    │  │ │  │  Browser    │  │ │  │  Browser    │  │
    │  │  Instance   │  │ │  │  Instance   │  │ │  │  Instance   │  │
    │  └─────────────┘  │ │  └─────────────┘  │ │  └─────────────┘  │
    └───────────────────┘ └───────────────────┘ └───────────────────┘
```

### Key Benefits

- **Process-Level Isolation**: Each session runs in a separate OS process
- **Backend Agnostic**: Works with any MCP browser automation server
- **Always Latest**: Uses `@latest` versions, no dependency updates needed
- **Automatic Cleanup**: Sessions are cleaned up on timeout or process exit

## Session Isolation Guarantee

**Each session is 100% isolated.** This is architecturally guaranteed by process-level separation.

| Resource | Isolated? | How |
|----------|-----------|-----|
| Browser Process | ✅ Yes | Separate OS process per session |
| Cookies | ✅ Yes | Separate browser instance |
| localStorage | ✅ Yes | Separate browser instance |
| DOM | ✅ Yes | Separate page instance |
| Navigation History | ✅ Yes | Separate page instance |

## Features

- **Parallel Sessions** - Each session gets its own browser instance
- **Process Isolation** - True isolation via separate OS processes
- **Pluggable Backends** - Use Playwright MCP, Chrome DevTools MCP, or any npm package
- **Dynamic Tools** - Tools are dynamically loaded from the backend
- **Low Overhead** - Only 3 session management tools + backend tools
- **Free & Local** - No cloud service required

## Installation

### With Claude Code

Add to your MCP settings:

```json
{
  "mcpServers": {
    "playwright-parallel": {
      "command": "npx",
      "args": ["playwright-parallel-mcp"]
    }
  }
}
```

### With npm

```bash
npm install -g playwright-parallel-mcp
playwright-parallel-mcp
```

## Available Tools

### Session Management (3 tools)

| Tool | Description |
|------|-------------|
| `create_session` | Create a new isolated browser session |
| `close_session` | Close a browser session and terminate its backend process |
| `list_sessions` | List all active sessions |

### Backend Tools (dynamically loaded)

All tools from the backend MCP server are automatically available with an added `sessionId` parameter. For example, with the default Playwright backend:

| Tool | Description |
|------|-------------|
| `browser_navigate` | Navigate to a URL |
| `browser_snapshot` | Get accessibility tree snapshot |
| `browser_click` | Click an element |
| `browser_fill` | Fill a form input |
| `browser_type` | Type text |
| `browser_press_key` | Press keyboard key |
| ... | And many more from [@playwright/mcp](https://github.com/microsoft/playwright-mcp) |

## Usage Examples

### Basic Navigation

```
User: Open example.com and take a screenshot

Claude: I'll create a browser session and navigate to example.com.

[create_session] -> sessionId: "abc123"
[browser_navigate sessionId="abc123" url="https://example.com"]
[browser_screenshot sessionId="abc123"]
```

### Parallel Sessions

```
User: Compare the homepage of two websites side by side

Claude: I'll create two browser sessions in parallel.

[create_session] -> sessionId: "session-a"
[create_session] -> sessionId: "session-b"
[browser_navigate sessionId="session-a" url="https://example.com"]
[browser_navigate sessionId="session-b" url="https://google.com"]
[browser_snapshot sessionId="session-a"]
[browser_snapshot sessionId="session-b"]
```

### Form Interaction

```
User: Fill out the login form

Claude: I'll fill in the form fields and submit.

[browser_fill sessionId="abc123" element="Email input" ref="e1" value="user@example.com"]
[browser_fill sessionId="abc123" element="Password input" ref="e2" value="***"]
[browser_click sessionId="abc123" element="Submit button" ref="e3"]
```

## Backend Configuration

### Default Backend (Playwright)

By default, playwright-parallel-mcp uses `@playwright/mcp` as the backend:

```json
{
  "mcpServers": {
    "playwright-parallel": {
      "command": "npx",
      "args": ["playwright-parallel-mcp"]
    }
  }
}
```

### Chrome DevTools Backend

To use Chrome DevTools MCP instead:

```json
{
  "mcpServers": {
    "playwright-parallel": {
      "command": "npx",
      "args": ["playwright-parallel-mcp"],
      "env": {
        "MCP_BACKEND": "chrome-devtools"
      }
    }
  }
}
```

### Custom Backend

Any npm package that provides an MCP server can be used:

```json
{
  "mcpServers": {
    "playwright-parallel": {
      "command": "npx",
      "args": ["playwright-parallel-mcp"],
      "env": {
        "MCP_BACKEND": "my-custom-mcp-server"
      }
    }
  }
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_BACKEND` | `playwright` | Backend MCP server: `playwright`, `chrome-devtools`, or any npm package |
| `MAX_SESSIONS` | 10 | Maximum number of concurrent browser sessions |
| `SESSION_TIMEOUT_MS` | 3600000 | Session inactivity timeout (1 hour) |

## Comparison

| Feature | Chrome DevTools MCP | Playwright MCP | **This Project** |
|---------|---------------------|----------------|------------------|
| Parallel Sessions | No | No | **Yes** |
| Session Isolation | No | No | **Yes (Process-level)** |
| Backend Choice | Chrome only | Playwright only | **Any MCP server** |
| Tool Updates | Manual | Manual | **Automatic (@latest)** |
| Cost | Free | Free | **Free** |

## Requirements

- Node.js 20+
- Backend browser requirements (e.g., Playwright browsers)

## Development

```bash
git clone https://github.com/sumyapp/playwright-parallel-mcp
cd playwright-parallel-mcp
pnpm install
pnpm build
pnpm start
```

### Running Tests

```bash
pnpm test
```

### Project Structure

```
src/
  index.ts           # MCP server entry point with tool definitions
  session-manager.ts # Session lifecycle management
  mcp-client.ts      # MCP client for child process communication
  types.ts           # Type definitions and backend configuration
```

## Security Warning

> **This MCP server provides powerful browser automation capabilities.**

- Backend tools like `browser_evaluate` execute arbitrary JavaScript
- File upload tools can access the file system
- Only use in controlled environments with trusted clients

## License

MIT
