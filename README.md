# playwright-parallel-mcp

**[English](README.md)** | [日本語](README.ja.md) | [中文](README.zh.md)

A Model Context Protocol (MCP) server that enables AI agents to control **multiple independent browser instances** in parallel.

## Security Warning

> **This MCP server provides powerful browser automation capabilities that can be exploited if exposed to untrusted parties.**

- **`run_script`**: Executes arbitrary JavaScript in the browser context
- **`generate_pdf`** / **`upload_file`**: Accesses the file system for reading/writing files
- **`add_init_script`**: Injects scripts that run on every page load

**Do not expose this server to untrusted users or AI agents.** Only use it in controlled environments where you trust all clients that can connect to it.

## The Problem

Existing browser automation MCP servers (Chrome DevTools MCP, Playwright MCP) share a single browser instance across all sessions, causing conflicts when multiple AI agents try to use them simultaneously.

## The Solution

playwright-parallel-mcp creates **isolated browser instances for each session**, enabling true parallel browser automation.

## Features

- **Parallel Sessions** - Each session gets its own browser instance
- **Multiple Browsers** - Chromium, Firefox, WebKit support
- **63 Tools** - Comprehensive browser automation capabilities
- **Console & Network Logs** - Full debugging support
- **JS Error Detection** - Capture JavaScript errors
- **Dialog Handling** - Handle alert, confirm, prompt dialogs
- **Performance Metrics** - Get timing and memory metrics
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

## Available Tools (63 total)

### Session Management (3 tools)
| Tool | Description |
|------|-------------|
| `create_session` | Create a new isolated browser session (chromium/firefox/webkit) |
| `close_session` | Close a browser session |
| `list_sessions` | List all active sessions |

### Navigation (5 tools)
| Tool | Description |
|------|-------------|
| `navigate` | Navigate to a URL |
| `go_back` | Go back in browser history |
| `go_forward` | Go forward in browser history |
| `reload` | Reload the current page |
| `get_url` | Get current URL and page title |

### Page Inspection (4 tools)
| Tool | Description |
|------|-------------|
| `snapshot` | Get accessibility tree (ARIA snapshot format) |
| `screenshot` | Take a screenshot (PNG/JPEG, full page or element) |
| `get_content` | Get text content of page or element |
| `get_html` | Get HTML of page or element |

### User Interaction (8 tools)
| Tool | Description |
|------|-------------|
| `click` | Click an element (left/right/middle button) |
| `fill` | Fill a form input with text |
| `select_option` | Select from dropdown |
| `hover` | Hover over an element |
| `press_key` | Press keyboard key (e.g., Enter, Control+A) |
| `type` | Type text with realistic key-by-key input |
| `check` | Check a checkbox |
| `uncheck` | Uncheck a checkbox |

### Wait Tools (5 tools)
| Tool | Description |
|------|-------------|
| `wait_for_selector` | Wait for an element to appear/disappear |
| `wait_for_load_state` | Wait for page load state (load/domcontentloaded/networkidle) |
| `wait_for_url` | Wait for URL to match a pattern |
| `wait_for_function` | Wait for JavaScript condition to be truthy |
| `wait_for_timeout` | Wait for a specified duration |

### Dialog Tools (2 tools)
| Tool | Description |
|------|-------------|
| `get_dialogs` | Get dialog history from the session |
| `set_dialog_handler` | Configure automatic dialog handling (accept/dismiss) |

### Element State Tools (5 tools)
| Tool | Description |
|------|-------------|
| `get_element_state` | Get element state (visible, enabled, checked, editable) |
| `get_attribute` | Get an attribute value from an element |
| `get_bounding_box` | Get the bounding box of an element |
| `count_elements` | Count elements matching a selector |
| `get_all_texts` | Get text content from all matching elements |

### File/Drag/Scroll Tools (4 tools)
| Tool | Description |
|------|-------------|
| `upload_file` | Upload file(s) to a file input element |
| `drag_and_drop` | Drag an element and drop it on another |
| `scroll` | Scroll the page or an element |
| `scroll_into_view` | Scroll an element into view |

### Mouse Tools (5 tools)
| Tool | Description |
|------|-------------|
| `mouse_move` | Move mouse to specific coordinates |
| `mouse_click` | Click at specific coordinates |
| `mouse_down` | Press mouse button down |
| `mouse_up` | Release mouse button |
| `mouse_wheel` | Scroll using mouse wheel |

### Emulation Tools (4 tools)
| Tool | Description |
|------|-------------|
| `set_viewport` | Change the viewport size |
| `set_geolocation` | Set geolocation for the browser context |
| `set_offline` | Set browser offline/online mode |
| `set_extra_http_headers` | Set extra HTTP headers for all requests |

### PDF/Frame Tools (5 tools)
| Tool | Description |
|------|-------------|
| `generate_pdf` | Generate a PDF of the current page (Chromium only) |
| `list_frames` | List all frames in the page |
| `frame_click` | Click on an element within a frame |
| `frame_fill` | Fill an input within a frame |
| `frame_get_content` | Get text content from an element within a frame |

### Debug Tools (6 tools)
| Tool | Description |
|------|-------------|
| `get_page_errors` | Get JavaScript errors from the page |
| `clear_logs` | Clear console/network/error/dialog logs |
| `expose_function` | Expose a function to the page that logs calls |
| `add_init_script` | Add a script to run before page load |
| `get_metrics` | Get page performance metrics |
| `get_accessibility_tree` | Get the accessibility tree of page or element |

### Storage/Cookie Tools (4 tools)
| Tool | Description |
|------|-------------|
| `get_cookies` | Get cookies from browser context |
| `set_cookies` | Set cookies in browser context |
| `get_storage` | Get localStorage/sessionStorage values |
| `set_storage` | Set localStorage/sessionStorage values |

### Logging Tools (3 tools)
| Tool | Description |
|------|-------------|
| `get_console_logs` | Get console logs (log/info/warn/error/debug) |
| `get_network_logs` | Get network request logs with filtering |
| `run_script` | Execute JavaScript in browser context |

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

### Debugging

```
User: Check for JavaScript errors on the page

Claude: I'll check for JavaScript errors and console logs.

[get_page_errors sessionId="abc123"]
[get_console_logs sessionId="abc123" types=["error"]]
```

### Dialog Handling

```
User: Handle the confirmation dialog

Claude: I'll set up automatic dialog handling and check for dialogs.

[set_dialog_handler sessionId="abc123" autoRespond=true accept=true]
[click sessionId="abc123" selector="#delete-button"]
[get_dialogs sessionId="abc123"]
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

### get_network_logs

Get network request logs with filtering options.

**Parameters:**
- `sessionId`: string
- `resourceTypes` (optional): array of "document" | "script" | "stylesheet" | "image" | "font" | "fetch" | "xhr" | "websocket" | "manifest" | "other"
- `methods` (optional): array of "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | "HEAD"
- `urlPattern` (optional): regex pattern to filter URLs
- `failedOnly` (optional): boolean (default: false)
- `limit` (optional): number (default: 100)

**Returns:** `{ requests: [...] }`

### run_script

Execute JavaScript in the browser context.

**Parameters:**
- `sessionId`: string
- `expression`: JavaScript expression to evaluate

**Returns:** `{ success: boolean, result?: any, error?: string }`

### get_metrics

Get page performance metrics.

**Parameters:**
- `sessionId`: string

**Returns:** `{ metrics: { loadTime, domContentLoaded, firstPaint, firstContentfulPaint, resourceCount, memory, transferSize } }`

## Comparison

| Feature | Chrome DevTools MCP | Playwright MCP | Browserbase | **This Project** |
|---------|---------------------|----------------|-------------|------------------|
| Parallel Sessions | No | No | Yes (Cloud) | **Yes (Local)** |
| Tool Count | ~20 | ~30 | ~10 | **63 tools** |
| Console Logs | Yes | Yes | No | **Yes** |
| Network Logs | Yes | No | No | **Yes** |
| JS Error Detection | No | No | No | **Yes** |
| Dialog Handling | Yes | No | No | **Yes** |
| Performance Metrics | Yes | No | No | **Yes** |
| Output Format | a11y tree | a11y tree | Screenshot | **ARIA snapshot** |
| JavaScript Execution | Yes | Yes | No | **Yes** |
| Cookie Management | Yes | No | No | **Yes** |
| Storage Access | No | No | No | **Yes** |
| File Upload | No | Yes | No | **Yes** |
| PDF Generation | No | No | No | **Yes** |
| Frame Support | Yes | No | No | **Yes** |
| Cost | Free | Free | Paid | **Free** |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
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

## License

MIT
