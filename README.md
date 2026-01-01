# playwright-parallel-mcp

[![CI](https://github.com/sumyapp/playwright-parallel-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/sumyapp/playwright-parallel-mcp/actions/workflows/ci.yml)
[![Coverage Status](https://coveralls.io/repos/github/sumyapp/playwright-parallel-mcp/badge.svg?branch=main)](https://coveralls.io/github/sumyapp/playwright-parallel-mcp?branch=main)
[![npm version](https://badge.fury.io/js/playwright-parallel-mcp.svg)](https://www.npmjs.com/package/playwright-parallel-mcp)

**[English](README.md)** | [日本語](README.ja.md) | [中文](README.zh.md)

A Model Context Protocol (MCP) server that enables AI agents to control **multiple independent browser instances** in parallel.

## Security Warning

> **This MCP server provides powerful browser automation capabilities that can be exploited if exposed to untrusted parties.**

- **`run_script`**: Executes arbitrary JavaScript in the browser context
- **`upload_file`**: Accesses the file system for uploading files
- **`generate_pdf`** / **`add_init_script`**: (Full mode only) Additional file system and script injection capabilities

**Do not expose this server to untrusted users or AI agents.** Only use it in controlled environments where you trust all clients that can connect to it.

## The Problem

Existing browser automation MCP servers (Chrome DevTools MCP, Playwright MCP) share a single browser instance across all sessions, causing conflicts when multiple AI agents try to use them simultaneously.

## The Solution

playwright-parallel-mcp creates **isolated browser instances for each session**, enabling true parallel browser automation.

## Session Isolation Guarantee

**Each session is 100% isolated.** This is architecturally guaranteed and verified by comprehensive tests.

### Architecture

```
Session A                    Session B                    Session C
    │                            │                            │
    ▼                            ▼                            ▼
┌─────────┐                ┌─────────┐                ┌─────────┐
│ Browser │                │ Browser │                │ Browser │
│ Process │                │ Process │                │ Process │
│  (OS)   │                │  (OS)   │                │  (OS)   │
└────┬────┘                └────┬────┘                └────┬────┘
     │                          │                          │
     ▼                          ▼                          ▼
┌─────────┐                ┌─────────┐                ┌─────────┐
│ Context │                │ Context │                │ Context │
│(cookies)│                │(cookies)│                │(cookies)│
└────┬────┘                └────┬────┘                └────┬────┘
     │                          │                          │
     ▼                          ▼                          ▼
┌─────────┐                ┌─────────┐                ┌─────────┐
│  Page   │                │  Page   │                │  Page   │
│ (DOM)   │                │ (DOM)   │                │ (DOM)   │
└─────────┘                └─────────┘                └─────────┘
```

### What's Isolated

| Resource | Isolated? | How |
|----------|-----------|-----|
| Browser Process | ✅ Yes | Separate OS process per session |
| Cookies | ✅ Yes | Separate BrowserContext |
| localStorage | ✅ Yes | Separate BrowserContext |
| sessionStorage | ✅ Yes | Separate BrowserContext |
| DOM | ✅ Yes | Separate Page instance |
| Navigation History | ✅ Yes | Separate Page instance |
| Console Logs | ✅ Yes | Stored per session |
| Network Logs | ✅ Yes | Stored per session |

### Test Coverage

Session isolation is verified by **17 dedicated tests** covering:

- Browser process isolation
- Navigation isolation
- DOM isolation
- Cookie isolation
- localStorage/sessionStorage isolation
- Console log isolation
- Network log isolation
- Concurrent operation safety
- Session ID uniqueness (UUID v4)

Run `pnpm test` to verify isolation guarantees.

## Features

- **Parallel Sessions** - Each session gets its own browser instance
- **Multiple Browsers** - Chromium, Firefox, WebKit support
- **22 Tools** - Essential browser automation (63 in Full mode)
- **Low Context Usage** - ~14k tokens (comparable to @playwright/mcp)
- **Console Logs** - Capture console output for debugging
- **Dialog Handling** - Handle alert, confirm, prompt dialogs
- **Accessibility Snapshots** - ARIA snapshot format (Playwright 1.49+)
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

## Available Tools (22 tools)

### Session Management (3)
| Tool | Description |
|------|-------------|
| `create_session` | Create a new isolated browser session (chromium/firefox/webkit) |
| `close_session` | Close a browser session |
| `list_sessions` | List all active sessions |

### Navigation (4)
| Tool | Description |
|------|-------------|
| `navigate` | Navigate to a URL |
| `go_back` | Go back in browser history |
| `reload` | Reload the current page |
| `get_url` | Get current URL and page title |

### Page Inspection (2)
| Tool | Description |
|------|-------------|
| `snapshot` | Get accessibility tree (ARIA snapshot format) |
| `screenshot` | Take a screenshot (PNG/JPEG, full page or element) |

### User Interaction (6)
| Tool | Description |
|------|-------------|
| `click` | Click an element (left/right/middle button) |
| `fill` | Fill a form input with text |
| `type` | Type text with realistic key-by-key input |
| `press_key` | Press keyboard key (e.g., Enter, Control+A) |
| `hover` | Hover over an element |
| `select_option` | Select from dropdown |

### Other Tools (7)
| Tool | Description |
|------|-------------|
| `wait_for_timeout` | Wait for a specified duration |
| `set_dialog_handler` | Configure automatic dialog handling (accept/dismiss) |
| `upload_file` | Upload file(s) to a file input element |
| `drag_and_drop` | Drag an element and drop it on another |
| `run_script` | Execute JavaScript in browser context |
| `get_console_logs` | Get console logs (log/info/warn/error/debug) |
| `set_viewport` | Change the viewport size |

## Usage Examples

### Basic Navigation

```
User: Open example.com and take a screenshot

Claude: I'll create a browser session and navigate to example.com.

[create_session] -> sessionId: "abc123"
[navigate sessionId="abc123" url="https://example.com"]
[screenshot sessionId="abc123"]
```

### Parallel Sessions

```
User: Compare the homepage of two websites side by side

Claude: I'll create two browser sessions in parallel.

[create_session] -> sessionId: "session-a"
[create_session] -> sessionId: "session-b"
[navigate sessionId="session-a" url="https://example.com"]
[navigate sessionId="session-b" url="https://google.com"]
[snapshot sessionId="session-a"]
[snapshot sessionId="session-b"]
```

### Form Interaction

```
User: Fill out the login form

Claude: I'll fill in the form fields and submit.

[fill sessionId="abc123" selector="input[name='email']" value="user@example.com"]
[fill sessionId="abc123" selector="input[name='password']" value="***"]
[click sessionId="abc123" selector="button[type='submit']"]
```

### Console Logs

```
User: Check console output on the page

Claude: I'll check for console logs and errors.

[get_console_logs sessionId="abc123" types=["error", "warn"]]
```

### Dialog Handling

```
User: Handle the confirmation dialog

Claude: I'll set up automatic dialog handling.

[set_dialog_handler sessionId="abc123" autoRespond=true accept=true]
[click sessionId="abc123" selector="#delete-button"]
```

## Tool Reference

### create_session

Creates a new isolated browser session.

**Parameters:**
- `browser` (optional): "chromium" | "firefox" | "webkit" (default: "chromium")
- `headless` (optional): boolean (default: true)
- `viewport` (optional): { width: number, height: number }

**Returns:** `{ sessionId, browser, createdAt }`

### navigate

Navigate to a URL.

**Parameters:**
- `sessionId`: string
- `url`: string (valid URL)
- `waitUntil` (optional): "load" | "domcontentloaded" | "networkidle" (default: "load")

**Returns:** `{ url, title, status }`

### snapshot

Get accessibility tree snapshot in ARIA format.

**Parameters:**
- `sessionId`: string

**Returns:** YAML-formatted accessibility tree

### run_script

Execute JavaScript in the browser context.

**Parameters:**
- `sessionId`: string
- `expression`: JavaScript expression to evaluate

**Returns:** `{ success: boolean, result?: any, error?: string }`

## Comparison

| Feature | Chrome DevTools MCP | Playwright MCP | **This Project** |
|---------|---------------------|----------------|------------------|
| Parallel Sessions | No | No | **Yes** |
| Session Isolation | No | No | **Yes (API-level)** |
| Tool Count | ~26 | ~22 | **22 (Lite) / 63 (Full)** |
| Context Tokens | ~17k | ~14k | **~14k (Lite) / ~40k (Full)** |
| Console Logs | Yes | Yes | **Yes** |
| Dialog Handling | Yes | No | **Yes** |
| JavaScript Execution | Yes | Yes | **Yes** |
| File Upload | No | Yes | **Yes** |
| Cost | Free | Free | **Free** |

### Context Token Usage (Measured)

Token consumption when loaded as MCP tools in Claude Code (`/context` command):

| MCP Server | Tools | Total Tokens | Avg/Tool |
|------------|-------|--------------|----------|
| **playwright-parallel-mcp (Lite)** | 22 | ~14,000 | 640 |
| **playwright-parallel-mcp (Full)** | 63 | 40,343 | 640 |
| [@playwright/mcp](https://github.com/microsoft/playwright-mcp) | 22 | 14,534 | 661 |
| [chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp) | 26 | 17,668 | 680 |

> **Lite mode (default)** provides the same tool count as @playwright/mcp with comparable token usage, while adding session isolation for parallel execution.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PLAYWRIGHT_PARALLEL_MODE` | `lite` | Mode: `lite` (22 tools) or `full` (63 tools) |
| `MAX_SESSIONS` | 10 | Maximum number of concurrent browser sessions |
| `SESSION_TIMEOUT_MS` | 3600000 | Session inactivity timeout (1 hour) |

## Requirements

- Node.js 20+
- Playwright browsers (installed automatically)

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
  index.ts          # MCP server entry point with all tool definitions
  session-manager.ts # Browser session lifecycle management
```

## Full Mode

Full mode provides capabilities that **cannot be replicated with `run_script`** and are essential for specific use cases.

### When to Use Full Mode

| Use Case | Required Tools | Why run_script Can't Help |
|----------|----------------|---------------------------|
| **API Monitoring** | `get_network_logs` | Captures all HTTP requests/responses including headers, timing, status codes |
| **Performance Analysis** | `get_metrics` | Access to Navigation Timing API, memory usage, paint metrics |
| **PDF Report Generation** | `generate_pdf` | Browser-level PDF rendering with page formatting options |
| **iframe Automation** | `frame_click`, `frame_fill` | Cross-origin iframe access that JavaScript cannot reach |
| **JS Error Detection** | `get_page_errors` | Captures uncaught exceptions before they're lost |
| **Accessibility Audits** | `get_accessibility_tree` | Full ARIA tree structure for compliance testing |

### Example: API Testing with Network Logs

```
User: Test the login API and verify the response

Claude: I'll monitor network requests during login.

[get_network_logs sessionId="abc" resourceTypes=["fetch","xhr"]]
→ Captured: POST /api/login (200, 145ms, response body available)
```

This is impossible with `run_script` because:
- Fetch/XHR interception requires setup before requests are made
- Response bodies are not accessible after completion
- Timing information is lost

### Configuration

```json
{
  "mcpServers": {
    "playwright-parallel": {
      "command": "npx",
      "args": ["playwright-parallel-mcp"],
      "env": {
        "PLAYWRIGHT_PARALLEL_MODE": "full"
      }
    }
  }
}
```

### Additional Tools (41 tools, ~40k tokens)

<details>
<summary>Click to expand full tool list</summary>

- **Navigation**: go_forward
- **Page Inspection**: get_content, get_html
- **User Interaction**: check, uncheck
- **Wait Tools**: wait_for_selector, wait_for_load_state, wait_for_url, wait_for_function
- **Dialog**: get_dialogs
- **Element State**: get_element_state, get_attribute, get_bounding_box, count_elements, get_all_texts
- **Scroll**: scroll, scroll_into_view
- **Mouse**: mouse_move, mouse_click, mouse_down, mouse_up, mouse_wheel
- **Emulation**: set_geolocation, set_offline, set_extra_http_headers
- **Storage/Cookies**: get_cookies, set_cookies, get_storage, set_storage
- **Network**: get_network_logs
- **PDF/Frame**: generate_pdf, list_frames, frame_click, frame_fill, frame_get_content
- **Debug**: get_page_errors, clear_logs, expose_function, add_init_script, get_metrics, get_accessibility_tree

</details>

## License

MIT
