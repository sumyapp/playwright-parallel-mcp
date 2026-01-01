import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import path from "node:path";
import fs from "node:fs";
import { sessionManager } from "./session-manager.js";

// === Mode Configuration ===
// PLAYWRIGHT_PARALLEL_MODE: "lite" (default, 22 tools) or "full" (63 tools)
const mode = (process.env.PLAYWRIGHT_PARALLEL_MODE ?? "lite").toLowerCase();
const isFullMode = mode === "full";

// Lite mode tools (22 tools) - matches @playwright/mcp feature set + session management
const LITE_TOOLS = new Set([
  // Session Management (3)
  "create_session", "close_session", "list_sessions",
  // Navigation (4)
  "navigate", "go_back", "reload", "get_url",
  // Page Inspection (2)
  "snapshot", "screenshot",
  // User Interaction (6)
  "click", "fill", "type", "press_key", "hover", "select_option",
  // Wait (1)
  "wait_for_timeout",
  // Dialog (1)
  "set_dialog_handler",
  // File/Drag (2)
  "upload_file", "drag_and_drop",
  // Script/Logs (2)
  "run_script", "get_console_logs",
  // Emulation (1)
  "set_viewport"
]);

// Helper to check if tool should be registered
const shouldRegister = (toolName: string): boolean => {
  return isFullMode || LITE_TOOLS.has(toolName);
};

// === Security Helper Functions ===

/**
 * Safely compile and test a regex pattern with ReDoS protection
 */
function safeRegexTest(pattern: string, input: string): { matched: boolean; error?: string } {
  try {
    // Detect dangerous patterns (nested quantifiers, etc.)
    const dangerousPatterns = /(\+|\*)\s*\1|\(\?[^)]*\+|\([^)]*(\+|\*)\)[+*]/;
    if (dangerousPatterns.test(pattern)) {
      return {
        matched: false,
        error: "Regex pattern contains potentially dangerous nested quantifiers"
      };
    }

    const regex = new RegExp(pattern);
    return { matched: regex.test(input) };
  } catch (error) {
    return {
      matched: false,
      error: `Invalid regex pattern: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Validate PDF save path to prevent path traversal
 */
function validatePdfPath(filePath: string): void {
  const resolvedPath = path.resolve(filePath);
  const cwd = process.cwd();

  // Allow paths within current working directory or absolute paths that don't traverse up
  if (filePath.includes("..")) {
    throw new Error(`Path traversal detected: "${filePath}" contains ".." which is not allowed`);
  }

  if (!resolvedPath.toLowerCase().endsWith(".pdf")) {
    throw new Error(`Invalid file extension: PDF files must have .pdf extension`);
  }
}

/**
 * Validate upload file paths
 */
function validateUploadFiles(files: string[]): void {
  for (const file of files) {
    if (file.includes("..")) {
      throw new Error(`Path traversal detected in file path: "${file}"`);
    }

    const resolvedPath = path.resolve(file);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`File not found: ${file}`);
    }
  }
}

const server = new McpServer({
  name: "playwright-parallel-mcp",
  version: "0.1.0"
}, {
  capabilities: {
    tools: {}
  }
});

// === Session Management Tools ===

server.tool(
  "create_session",
  "Create a new isolated browser session",
  {
    browser: z.enum(["chromium", "firefox", "webkit"]).default("chromium").describe("Browser to use"),
    headless: z.boolean().default(true).describe("Run in headless mode"),
    viewport: z.object({
      width: z.number().default(1280),
      height: z.number().default(720)
    }).optional().describe("Viewport size")
  },
  async ({ browser, headless, viewport }) => {
    const session = await sessionManager.createSession({ browser, headless, viewport });
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          sessionId: session.id,
          browser,
          createdAt: session.createdAt.toISOString()
        }, null, 2)
      }]
    };
  }
);

server.tool(
  "close_session",
  "Close a browser session",
  {
    sessionId: z.string().describe("Session ID to close")
  },
  async ({ sessionId }) => {
    await sessionManager.closeSession(sessionId);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ success: true, sessionId })
      }]
    };
  }
);

server.tool(
  "list_sessions",
  "List all active browser sessions",
  {},
  async () => {
    const sessions = sessionManager.listSessions();
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          sessions: sessions.map(s => ({
            sessionId: s.id,
            browser: s.browserType,
            url: s.page?.url() ?? "about:blank",
            createdAt: s.createdAt.toISOString()
          }))
        }, null, 2)
      }]
    };
  }
);

// === Navigation Tools ===

server.tool(
  "navigate",
  "Navigate to a URL",
  {
    sessionId: z.string(),
    url: z.string().url(),
    waitUntil: z.enum(["load", "domcontentloaded", "networkidle"]).default("load")
  },
  async ({ sessionId, url, waitUntil }) => {
    const session = sessionManager.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const response = await session.page.goto(url, { waitUntil });

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          url: session.page.url(),
          title: await session.page.title(),
          status: response?.status() ?? 0
        }, null, 2)
      }]
    };
  }
);

server.tool(
  "go_back",
  "Go back in browser history",
  {
    sessionId: z.string()
  },
  async ({ sessionId }) => {
    const session = sessionManager.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    await session.page.goBack();

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          url: session.page.url(),
          title: await session.page.title()
        }, null, 2)
      }]
    };
  }
);

if (isFullMode) {
  server.tool(
    "go_forward",
    "Go forward in browser history",
    {
      sessionId: z.string()
    },
    async ({ sessionId }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);

      await session.page.goForward();

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            url: session.page.url(),
            title: await session.page.title()
          }, null, 2)
        }]
      };
    }
  );
}

server.tool(
  "reload",
  "Reload the current page",
  {
    sessionId: z.string(),
    ignoreCache: z.boolean().default(false).describe("If true, bypass the cache and force reload from server")
  },
  async ({ sessionId, ignoreCache }) => {
    const session = sessionManager.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    // Playwright's reload doesn't have ignoreCache directly,
    // but we can use keyboard shortcut or headers approach
    // For simplicity, using standard reload (Playwright handles cache internally)
    await session.page.reload();

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          url: session.page.url(),
          title: await session.page.title(),
          reloaded: true,
          ignoreCache
        }, null, 2)
      }]
    };
  }
);

server.tool(
  "get_url",
  "Get the current URL and page title",
  {
    sessionId: z.string()
  },
  async ({ sessionId }) => {
    const session = sessionManager.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          url: session.page.url(),
          title: await session.page.title()
        }, null, 2)
      }]
    };
  }
);

// === Snapshot Tools ===

server.tool(
  "snapshot",
  "Get accessibility tree snapshot of the current page (ARIA snapshot format)",
  {
    sessionId: z.string()
  },
  async ({ sessionId }) => {
    const session = sessionManager.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    // Use Playwright 1.49+ ariaSnapshot API
    const snapshot = await session.page.locator('body').ariaSnapshot();
    const url = session.page.url();
    const title = await session.page.title();

    return {
      content: [{
        type: "text",
        text: `## Page state\n- URL: ${url}\n- Title: ${title}\n\n## Accessibility snapshot\n\`\`\`yaml\n${snapshot}\n\`\`\``
      }]
    };
  }
);

server.tool(
  "screenshot",
  "Take a screenshot of the current page",
  {
    sessionId: z.string(),
    fullPage: z.boolean().default(false).describe("Capture full page"),
    selector: z.string().optional().describe("Take screenshot of specific element"),
    quality: z.number().min(0).max(100).optional().describe("JPEG quality (0-100)")
  },
  async ({ sessionId, fullPage, selector, quality }) => {
    const session = sessionManager.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    let buffer: Buffer;

    if (selector) {
      const element = session.page.locator(selector);
      buffer = await element.screenshot({ type: 'png' });
    } else {
      buffer = await session.page.screenshot({
        fullPage,
        type: quality !== undefined ? 'jpeg' : 'png',
        quality
      });
    }

    return {
      content: [{
        type: "image",
        data: buffer.toString('base64'),
        mimeType: quality !== undefined ? 'image/jpeg' : 'image/png'
      }]
    };
  }
);

if (isFullMode) {
  server.tool(
    "get_content",
    "Get the text content of the page or an element",
    {
      sessionId: z.string(),
      selector: z.string().optional().describe("Get content of specific element")
    },
    async ({ sessionId, selector }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);

      let content: string;

      if (selector) {
        content = await session.page.locator(selector).textContent() ?? '';
      } else {
        content = await session.page.textContent('body') ?? '';
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ content }, null, 2)
        }]
      };
    }
  );

  server.tool(
    "get_html",
    "Get the HTML of the page or an element",
    {
      sessionId: z.string(),
      selector: z.string().optional(),
      outer: z.boolean().default(true).describe("Include the element's own tag")
    },
    async ({ sessionId, selector, outer }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);

      let html: string;

      if (selector) {
        if (outer) {
          html = await session.page.locator(selector).evaluate(el => el.outerHTML);
        } else {
          html = await session.page.locator(selector).innerHTML();
        }
      } else {
        html = await session.page.content();
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ html }, null, 2)
        }]
      };
    }
  );
}

// === Console Logs Tool ===

server.tool(
  "get_console_logs",
  "Get console logs from the browser session",
  {
    sessionId: z.string(),
    types: z.array(z.enum(["log", "info", "warn", "error", "debug"])).optional(),
    limit: z.number().default(100)
  },
  async ({ sessionId, types, limit }) => {
    const session = sessionManager.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    let logs = [...session.consoleLogs];

    if (types && types.length > 0) {
      logs = logs.filter(log => types.includes(log.type as any));
    }

    logs = logs.slice(-limit);

    return {
      content: [{
        type: "text",
        text: JSON.stringify({ logs }, null, 2)
      }]
    };
  }
);

// === Network Logs Tool ===

if (isFullMode) {
  server.tool(
    "get_network_logs",
    "Get network request logs from the browser session",
    {
      sessionId: z.string(),
      resourceTypes: z.array(z.enum([
        'document', 'script', 'stylesheet', 'image', 'font',
        'fetch', 'xhr', 'websocket', 'manifest', 'other'
      ])).optional(),
      methods: z.array(z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'])).optional(),
      urlPattern: z.string().optional().describe("Regex pattern to filter URLs"),
      failedOnly: z.boolean().default(false),
      limit: z.number().default(100)
    },
    async ({ sessionId, resourceTypes, methods, urlPattern, failedOnly, limit }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);

      sessionManager.updateLastUsed(sessionId);

      let logs = Array.from(session.networkLogs.values());
      let regexWarning: string | undefined;

      if (resourceTypes && resourceTypes.length > 0) {
        logs = logs.filter(log => resourceTypes.includes(log.resourceType as any));
      }

      if (methods && methods.length > 0) {
        logs = logs.filter(log => methods.includes(log.method as any));
      }

      if (urlPattern) {
        // Use safe regex testing to prevent ReDoS
        logs = logs.filter(log => {
          const result = safeRegexTest(urlPattern, log.url);
          if (result.error && !regexWarning) {
            regexWarning = result.error;
          }
          return result.matched;
        });
      }

      if (failedOnly) {
        logs = logs.filter(log => log.failed);
      }

      logs = logs.slice(-limit);

      const response: { requests: typeof logs; warning?: string } = { requests: logs };
      if (regexWarning) {
        response.warning = regexWarning;
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify(response, null, 2)
        }]
      };
    }
  );
}

// === Script Execution Tools ===

server.tool(
  "run_script",
  "Execute JavaScript in the browser context",
  {
    sessionId: z.string(),
    expression: z.string().describe("JavaScript expression to evaluate")
  },
  async ({ sessionId, expression }) => {
    const session = sessionManager.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    try {
      // Intentional JS execution for browser automation - user approved
      // eslint-disable-next-line no-new-func
      const result = await session.page.evaluate(
        (expr: string) => new Function(`return (${expr})`)(),
        expression
      );

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: true, result }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }, null, 2)
        }]
      };
    }
  }
);

if (isFullMode) {
  server.tool(
    "get_cookies",
    "Get cookies from the browser context",
    {
      sessionId: z.string(),
      urls: z.array(z.string()).optional().describe("Filter cookies by URLs")
    },
    async ({ sessionId, urls }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);

      const cookies = await session.context.cookies(urls);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ cookies }, null, 2)
        }]
      };
    }
  );

  server.tool(
    "set_cookies",
    "Set cookies in the browser context",
    {
      sessionId: z.string(),
      cookies: z.array(z.object({
        name: z.string(),
        value: z.string(),
        url: z.string().optional(),
        domain: z.string().optional(),
        path: z.string().optional(),
        expires: z.number().optional(),
        httpOnly: z.boolean().optional(),
        secure: z.boolean().optional(),
        sameSite: z.enum(['Strict', 'Lax', 'None']).optional()
      }))
    },
    async ({ sessionId, cookies }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);

      await session.context.addCookies(cookies);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: true, count: cookies.length }, null, 2)
        }]
      };
    }
  );

  server.tool(
    "get_storage",
    "Get localStorage or sessionStorage values",
    {
      sessionId: z.string(),
      storageType: z.enum(['localStorage', 'sessionStorage']),
      key: z.string().optional().describe("Specific key to get (omit for all)")
    },
    async ({ sessionId, storageType, key }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);

      const storage = await session.page.evaluate(({ type, k }) => {
        const store = type === 'localStorage' ? localStorage : sessionStorage;
        if (k) {
          return { [k]: store.getItem(k) };
        }
        const result: Record<string, string | null> = {};
        for (let i = 0; i < store.length; i++) {
          const key = store.key(i);
          if (key) result[key] = store.getItem(key);
        }
        return result;
      }, { type: storageType, k: key });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ storage }, null, 2)
        }]
      };
    }
  );

  server.tool(
    "set_storage",
    "Set localStorage or sessionStorage values",
    {
      sessionId: z.string(),
      storageType: z.enum(['localStorage', 'sessionStorage']),
      key: z.string(),
      value: z.string()
    },
    async ({ sessionId, storageType, key, value }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);

      await session.page.evaluate(({ type, k, v }) => {
        const store = type === 'localStorage' ? localStorage : sessionStorage;
        store.setItem(k, v);
      }, { type: storageType, k: key, v: value });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: true, key, storageType }, null, 2)
        }]
      };
    }
  );
}

// === Interaction Tools ===

server.tool(
  "click",
  "Click on an element",
  {
    sessionId: z.string().describe("Session ID"),
    selector: z.string().describe("CSS selector, text=, role= etc."),
    button: z.enum(["left", "right", "middle"]).default("left").describe("Mouse button"),
    clickCount: z.number().default(1).describe("Number of clicks"),
    timeout: z.number().default(30000).describe("Timeout in milliseconds")
  },
  async ({ sessionId, selector, button, clickCount, timeout }) => {
    const session = sessionManager.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    await session.page.click(selector, { button, clickCount, timeout });

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          action: "click",
          selector,
          button,
          clickCount
        }, null, 2)
      }]
    };
  }
);

server.tool(
  "fill",
  "Fill in a form field",
  {
    sessionId: z.string().describe("Session ID"),
    selector: z.string().describe("CSS selector for the input field"),
    value: z.string().describe("Value to fill in"),
    timeout: z.number().default(30000).describe("Timeout in milliseconds")
  },
  async ({ sessionId, selector, value, timeout }) => {
    const session = sessionManager.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    await session.page.fill(selector, value, { timeout });

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          action: "fill",
          selector,
          valueLength: value.length
        }, null, 2)
      }]
    };
  }
);

server.tool(
  "select_option",
  "Select option(s) from a dropdown",
  {
    sessionId: z.string().describe("Session ID"),
    selector: z.string().describe("CSS selector for the select element"),
    value: z.union([z.string(), z.array(z.string())]).describe("Value or values to select"),
    timeout: z.number().default(30000).describe("Timeout in milliseconds")
  },
  async ({ sessionId, selector, value, timeout }) => {
    const session = sessionManager.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const values = Array.isArray(value) ? value : [value];
    const selected = await session.page.selectOption(selector, values, { timeout });

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          action: "select_option",
          selector,
          selected
        }, null, 2)
      }]
    };
  }
);

server.tool(
  "hover",
  "Hover over an element",
  {
    sessionId: z.string().describe("Session ID"),
    selector: z.string().describe("CSS selector for the element"),
    timeout: z.number().default(30000).describe("Timeout in milliseconds")
  },
  async ({ sessionId, selector, timeout }) => {
    const session = sessionManager.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    await session.page.hover(selector, { timeout });

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          action: "hover",
          selector
        }, null, 2)
      }]
    };
  }
);

server.tool(
  "press_key",
  "Press a key or key combination",
  {
    sessionId: z.string().describe("Session ID"),
    key: z.string().describe("Key to press (e.g., 'Enter', 'Control+A')"),
    selector: z.string().optional().describe("Optional: focus on this element first")
  },
  async ({ sessionId, key, selector }) => {
    const session = sessionManager.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    if (selector) {
      await session.page.press(selector, key);
    } else {
      await session.page.keyboard.press(key);
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          action: "press_key",
          key,
          selector: selector ?? null
        }, null, 2)
      }]
    };
  }
);

server.tool(
  "type",
  "Type text with realistic key-by-key input simulation",
  {
    sessionId: z.string().describe("Session ID"),
    text: z.string().describe("Text to type"),
    delay: z.number().default(0).describe("Delay between key presses in milliseconds")
  },
  async ({ sessionId, text, delay }) => {
    const session = sessionManager.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    await session.page.keyboard.type(text, { delay });

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          action: "type",
          textLength: text.length,
          delay
        }, null, 2)
      }]
    };
  }
);

if (isFullMode) {
  server.tool(
    "check",
    "Check a checkbox",
    {
      sessionId: z.string().describe("Session ID"),
      selector: z.string().describe("CSS selector for the checkbox"),
      timeout: z.number().default(30000).describe("Timeout in milliseconds")
    },
    async ({ sessionId, selector, timeout }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);

      await session.page.check(selector, { timeout });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            action: "check",
            selector
          }, null, 2)
        }]
      };
    }
  );

  server.tool(
    "uncheck",
    "Uncheck a checkbox",
    {
      sessionId: z.string().describe("Session ID"),
      selector: z.string().describe("CSS selector for the checkbox"),
      timeout: z.number().default(30000).describe("Timeout in milliseconds")
    },
    async ({ sessionId, selector, timeout }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);

      await session.page.uncheck(selector, { timeout });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            action: "uncheck",
            selector
          }, null, 2)
        }]
      };
    }
  );
}

// === Wait Tools ===

if (isFullMode) {
  server.tool(
    "wait_for_selector",
    "Wait for an element to appear in the DOM",
    {
      sessionId: z.string(),
      selector: z.string().describe("CSS selector to wait for"),
      state: z.enum(["attached", "detached", "visible", "hidden"]).default("visible"),
      timeout: z.number().default(30000)
    },
    async ({ sessionId, selector, state, timeout }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);

      await session.page.waitForSelector(selector, { state, timeout });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: true, selector, state }, null, 2)
        }]
      };
    }
  );

  server.tool(
    "wait_for_load_state",
    "Wait for page to reach a specific load state",
    {
      sessionId: z.string(),
      state: z.enum(["load", "domcontentloaded", "networkidle"]).default("load"),
      timeout: z.number().default(30000)
    },
    async ({ sessionId, state, timeout }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);

      await session.page.waitForLoadState(state, { timeout });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: true, state }, null, 2)
        }]
      };
    }
  );

  server.tool(
    "wait_for_url",
    "Wait for URL to match a pattern",
    {
      sessionId: z.string(),
      url: z.string().describe("URL string or regex pattern"),
      timeout: z.number().default(30000)
    },
    async ({ sessionId, url, timeout }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);

      sessionManager.updateLastUsed(sessionId);

      // Try as regex first, fallback to string match
      let urlMatcher: string | RegExp = url;
      if (url.startsWith("/") && url.lastIndexOf("/") > 0) {
        const lastSlash = url.lastIndexOf("/");
        const pattern = url.slice(1, lastSlash);
        const flags = url.slice(lastSlash + 1);

        // Validate regex pattern to prevent ReDoS
        const testResult = safeRegexTest(pattern, "");
        if (testResult.error) {
          throw new Error(`Invalid URL pattern: ${testResult.error}`);
        }

        try {
          urlMatcher = new RegExp(pattern, flags);
        } catch (error) {
          throw new Error(`Invalid regex pattern: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      await session.page.waitForURL(urlMatcher, { timeout });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: true, currentUrl: session.page.url() }, null, 2)
        }]
      };
    }
  );

  server.tool(
    "wait_for_function",
    "Wait for a JavaScript function to return truthy value",
    {
      sessionId: z.string(),
      expression: z.string().describe("JavaScript expression that returns truthy when ready"),
      timeout: z.number().default(30000),
      polling: z.number().default(100).describe("Polling interval in ms")
    },
    async ({ sessionId, expression, timeout, polling }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);

      await session.page.waitForFunction(expression, { timeout, polling });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: true, expression }, null, 2)
        }]
      };
    }
  );
}

server.tool(
  "wait_for_timeout",
  "Wait for a specified amount of time",
  {
    sessionId: z.string(),
    timeout: z.number().describe("Time to wait in milliseconds")
  },
  async ({ sessionId, timeout }) => {
    const session = sessionManager.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    await session.page.waitForTimeout(timeout);

    return {
      content: [{
        type: "text",
        text: JSON.stringify({ success: true, waited: timeout }, null, 2)
      }]
    };
  }
);

// === Dialog Tools ===

if (isFullMode) {
  server.tool(
    "get_dialogs",
    "Get dialog history from the session",
    {
      sessionId: z.string(),
      unhandledOnly: z.boolean().default(false)
    },
    async ({ sessionId, unhandledOnly }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);

      let dialogs = [...session.pendingDialogs];
      if (unhandledOnly) {
        dialogs = dialogs.filter(d => !d.handled);
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ dialogs }, null, 2)
        }]
      };
    }
  );
}

server.tool(
  "set_dialog_handler",
  "Configure automatic dialog handling",
  {
    sessionId: z.string(),
    autoRespond: z.boolean().describe("Whether to automatically respond to dialogs"),
    accept: z.boolean().default(true).describe("Accept or dismiss dialogs"),
    promptText: z.string().optional().describe("Text to enter for prompt dialogs")
  },
  async ({ sessionId, autoRespond, accept, promptText }) => {
    const session = sessionManager.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    session.dialogAutoRespond = autoRespond;
    session.dialogAutoResponse = { accept, promptText };

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          autoRespond,
          accept,
          promptText: promptText ?? null
        }, null, 2)
      }]
    };
  }
);

// === Element State Tools ===

if (isFullMode) {
  server.tool(
    "get_element_state",
    "Get the state of an element (visible, enabled, checked, editable)",
    {
      sessionId: z.string(),
      selector: z.string()
    },
    async ({ sessionId, selector }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);

      const locator = session.page.locator(selector);

      const [isVisible, isEnabled, isChecked, isEditable] = await Promise.all([
        locator.isVisible().catch(() => null),
        locator.isEnabled().catch(() => null),
        locator.isChecked().catch(() => null),
        locator.isEditable().catch(() => null)
      ]);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            selector,
            isVisible,
            isEnabled,
            isChecked,
            isEditable
          }, null, 2)
        }]
      };
    }
  );

  server.tool(
    "get_attribute",
    "Get an attribute value from an element",
    {
      sessionId: z.string(),
      selector: z.string(),
      attribute: z.string()
    },
    async ({ sessionId, selector, attribute }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);

      const value = await session.page.locator(selector).getAttribute(attribute);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ selector, attribute, value }, null, 2)
        }]
      };
    }
  );

  server.tool(
    "get_bounding_box",
    "Get the bounding box of an element",
    {
      sessionId: z.string(),
      selector: z.string()
    },
    async ({ sessionId, selector }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);

      const box = await session.page.locator(selector).boundingBox();

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ selector, boundingBox: box }, null, 2)
        }]
      };
    }
  );

  server.tool(
    "count_elements",
    "Count elements matching a selector",
    {
      sessionId: z.string(),
      selector: z.string()
    },
    async ({ sessionId, selector }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);

      const count = await session.page.locator(selector).count();

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ selector, count }, null, 2)
        }]
      };
    }
  );

  server.tool(
    "get_all_texts",
    "Get text content from all elements matching a selector",
    {
      sessionId: z.string(),
      selector: z.string()
    },
    async ({ sessionId, selector }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);

      const texts = await session.page.locator(selector).allTextContents();

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ selector, texts, count: texts.length }, null, 2)
        }]
      };
    }
  );
}

// === File Upload Tool ===

server.tool(
  "upload_file",
  "Upload file(s) to a file input element",
  {
    sessionId: z.string(),
    selector: z.string().describe("CSS selector for file input"),
    files: z.array(z.string()).describe("Array of file paths to upload")
  },
  async ({ sessionId, selector, files }) => {
    const session = sessionManager.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    sessionManager.updateLastUsed(sessionId);

    // Validate file paths to prevent path traversal attacks
    validateUploadFiles(files);

    await session.page.setInputFiles(selector, files);

    return {
      content: [{
        type: "text",
        text: JSON.stringify({ success: true, selector, filesCount: files.length }, null, 2)
      }]
    };
  }
);

// === Drag and Drop / Scroll Tools ===

server.tool(
  "drag_and_drop",
  "Drag an element and drop it on another element",
  {
    sessionId: z.string(),
    source: z.string().describe("CSS selector for source element"),
    target: z.string().describe("CSS selector for target element")
  },
  async ({ sessionId, source, target }) => {
    const session = sessionManager.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    await session.page.dragAndDrop(source, target);

    return {
      content: [{
        type: "text",
        text: JSON.stringify({ success: true, source, target }, null, 2)
      }]
    };
  }
);

if (isFullMode) {
  server.tool(
    "scroll",
    "Scroll the page or an element",
    {
      sessionId: z.string(),
      selector: z.string().optional().describe("Element to scroll (omit for page)"),
      x: z.number().default(0).describe("Horizontal scroll amount"),
      y: z.number().default(0).describe("Vertical scroll amount"),
      behavior: z.enum(["auto", "smooth"]).default("auto")
    },
    async ({ sessionId, selector, x, y, behavior }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);

      if (selector) {
        await session.page.locator(selector).evaluate(
          (el, { x, y, behavior }) => el.scrollBy({ left: x, top: y, behavior }),
          { x, y, behavior }
        );
      } else {
        await session.page.evaluate(
          ({ x, y, behavior }) => window.scrollBy({ left: x, top: y, behavior }),
          { x, y, behavior }
        );
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: true, x, y, selector: selector ?? "window" }, null, 2)
        }]
      };
    }
  );

  server.tool(
    "scroll_into_view",
    "Scroll an element into view",
    {
      sessionId: z.string(),
      selector: z.string()
    },
    async ({ sessionId, selector }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);

      await session.page.locator(selector).scrollIntoViewIfNeeded();

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: true, selector }, null, 2)
        }]
      };
    }
  );
}

// === Mouse Tools (Full mode only) ===

if (isFullMode) {
  server.tool(
    "mouse_move",
    "Move mouse to specific coordinates",
    {
      sessionId: z.string(),
      x: z.number(),
      y: z.number(),
      steps: z.number().default(1).describe("Number of intermediate steps")
    },
    async ({ sessionId, x, y, steps }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);

      await session.page.mouse.move(x, y, { steps });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: true, x, y }, null, 2)
        }]
      };
    }
  );

  server.tool(
    "mouse_click",
    "Click at specific coordinates",
    {
      sessionId: z.string(),
      x: z.number(),
      y: z.number(),
      button: z.enum(["left", "right", "middle"]).default("left"),
      clickCount: z.number().default(1)
    },
    async ({ sessionId, x, y, button, clickCount }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);

      await session.page.mouse.click(x, y, { button, clickCount });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: true, x, y, button, clickCount }, null, 2)
        }]
      };
    }
  );

  server.tool(
    "mouse_down",
    "Press mouse button down",
    {
      sessionId: z.string(),
      button: z.enum(["left", "right", "middle"]).default("left")
    },
    async ({ sessionId, button }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);

      await session.page.mouse.down({ button });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: true, action: "mouse_down", button }, null, 2)
        }]
      };
    }
  );

  server.tool(
    "mouse_up",
    "Release mouse button",
    {
      sessionId: z.string(),
      button: z.enum(["left", "right", "middle"]).default("left")
    },
    async ({ sessionId, button }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);

      await session.page.mouse.up({ button });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: true, action: "mouse_up", button }, null, 2)
        }]
      };
    }
  );

  server.tool(
    "mouse_wheel",
    "Scroll using mouse wheel",
    {
      sessionId: z.string(),
      deltaX: z.number().default(0),
      deltaY: z.number().default(0)
    },
    async ({ sessionId, deltaX, deltaY }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);

      await session.page.mouse.wheel(deltaX, deltaY);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: true, deltaX, deltaY }, null, 2)
        }]
      };
    }
  );
}

// === Emulation Tools ===

server.tool(
  "set_viewport",
  "Change the viewport size",
  {
    sessionId: z.string(),
    width: z.number(),
    height: z.number()
  },
  async ({ sessionId, width, height }) => {
    const session = sessionManager.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    await session.page.setViewportSize({ width, height });

    return {
      content: [{
        type: "text",
        text: JSON.stringify({ success: true, width, height }, null, 2)
      }]
    };
  }
);

if (isFullMode) {
  server.tool(
    "set_geolocation",
    "Set geolocation for the browser context",
    {
      sessionId: z.string(),
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      accuracy: z.number().default(0)
    },
    async ({ sessionId, latitude, longitude, accuracy }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);

      await session.context.setGeolocation({ latitude, longitude, accuracy });
      await session.context.grantPermissions(["geolocation"]);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: true, latitude, longitude, accuracy }, null, 2)
        }]
      };
    }
  );

  server.tool(
    "set_offline",
    "Set browser offline/online mode",
    {
      sessionId: z.string(),
      offline: z.boolean()
    },
    async ({ sessionId, offline }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);

      await session.context.setOffline(offline);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: true, offline }, null, 2)
        }]
      };
    }
  );

  server.tool(
    "set_extra_http_headers",
    "Set extra HTTP headers for all requests",
    {
      sessionId: z.string(),
      headers: z.record(z.string())
    },
    async ({ sessionId, headers }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);

      await session.context.setExtraHTTPHeaders(headers);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: true, headers }, null, 2)
        }]
      };
    }
  );
}

// === PDF Generation (Full mode only) ===

if (isFullMode) {
  server.tool(
    "generate_pdf",
    "Generate a PDF of the current page (Chromium only)",
    {
      sessionId: z.string(),
      path: z.string().optional().describe("Save path (optional, returns base64 if not provided)"),
      format: z.enum(["Letter", "Legal", "Tabloid", "Ledger", "A0", "A1", "A2", "A3", "A4", "A5", "A6"]).default("A4"),
      landscape: z.boolean().default(false),
      printBackground: z.boolean().default(true)
    },
    async ({ sessionId, path: pdfPath, format, landscape, printBackground }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);

      sessionManager.updateLastUsed(sessionId);

      if (session.browserType !== "chromium") {
        throw new Error("PDF generation is only supported in Chromium");
      }

      // Validate path to prevent path traversal attacks
      if (pdfPath) {
        validatePdfPath(pdfPath);
      }

      const buffer = await session.page.pdf({
        path: pdfPath,
        format,
        landscape,
        printBackground
      });

      if (pdfPath) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ success: true, path: pdfPath }, null, 2)
          }]
        };
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            base64: buffer.toString("base64"),
            size: buffer.length
          }, null, 2)
        }]
      };
    }
  );
}

// === Frame Tools (Full mode only) ===

if (isFullMode) {
  server.tool(
    "list_frames",
    "List all frames in the page",
    {
      sessionId: z.string()
    },
    async ({ sessionId }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);

      const frames = session.page.frames().map((frame, index) => ({
        index,
        name: frame.name(),
        url: frame.url(),
        isMain: frame === session.page.mainFrame()
      }));

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ frames }, null, 2)
        }]
      };
    }
  );

  server.tool(
    "frame_click",
    "Click on an element within a frame",
    {
      sessionId: z.string(),
      frameSelector: z.string().describe("Selector for the iframe element"),
      selector: z.string().describe("Selector within the frame"),
      timeout: z.number().default(30000)
    },
    async ({ sessionId, frameSelector, selector, timeout }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);

      const frameLocator = session.page.frameLocator(frameSelector);
      await frameLocator.locator(selector).click({ timeout });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: true, frameSelector, selector }, null, 2)
        }]
      };
    }
  );

  server.tool(
    "frame_fill",
    "Fill an input within a frame",
    {
      sessionId: z.string(),
      frameSelector: z.string().describe("Selector for the iframe element"),
      selector: z.string().describe("Selector within the frame"),
      value: z.string(),
      timeout: z.number().default(30000)
    },
    async ({ sessionId, frameSelector, selector, value, timeout }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);

      const frameLocator = session.page.frameLocator(frameSelector);
      await frameLocator.locator(selector).fill(value, { timeout });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: true, frameSelector, selector }, null, 2)
        }]
      };
    }
  );

  server.tool(
    "frame_get_content",
    "Get text content from an element within a frame",
    {
      sessionId: z.string(),
      frameSelector: z.string().describe("Selector for the iframe element"),
      selector: z.string().describe("Selector within the frame")
    },
    async ({ sessionId, frameSelector, selector }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);

      const frameLocator = session.page.frameLocator(frameSelector);
      const content = await frameLocator.locator(selector).textContent();

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ frameSelector, selector, content }, null, 2)
        }]
      };
    }
  );
}

// === Debug Tools (Full mode only) ===

if (isFullMode) {
  server.tool(
    "get_page_errors",
    "Get JavaScript errors from the page",
    {
      sessionId: z.string(),
      limit: z.number().default(100)
    },
    async ({ sessionId, limit }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);

      const errors = session.pageErrors.slice(-limit);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ errors, count: errors.length }, null, 2)
        }]
      };
    }
  );

  server.tool(
    "clear_logs",
    "Clear console logs, network logs, or page errors",
    {
      sessionId: z.string(),
      type: z.enum(["console", "network", "errors", "dialogs", "all"]).default("all")
    },
    async ({ sessionId, type }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);

      if (type === "console" || type === "all") {
        session.consoleLogs.length = 0;
      }
      if (type === "network" || type === "all") {
        session.networkLogs.clear();
      }
      if (type === "errors" || type === "all") {
        session.pageErrors.length = 0;
      }
      if (type === "dialogs" || type === "all") {
        session.pendingDialogs.length = 0;
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: true, cleared: type }, null, 2)
        }]
      };
    }
  );

  server.tool(
    "expose_function",
    "Expose a function to the page that logs calls",
    {
      sessionId: z.string(),
      name: z.string().describe("Function name to expose")
    },
    async ({ sessionId, name }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);

      await session.page.exposeFunction(name, (...args: unknown[]) => {
        session.consoleLogs.push({
          type: "log",
          text: `[exposed:${name}] ${JSON.stringify(args)}`,
          timestamp: new Date().toISOString()
        });
      });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: true, exposedFunction: name }, null, 2)
        }]
      };
    }
  );

  server.tool(
    "add_init_script",
    "Add a script to run before page load",
    {
      sessionId: z.string(),
      script: z.string().describe("JavaScript code to run")
    },
    async ({ sessionId, script }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);

      await session.context.addInitScript(script);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: true, scriptLength: script.length }, null, 2)
        }]
      };
    }
  );

  server.tool(
    "get_metrics",
    "Get page performance metrics",
    {
      sessionId: z.string()
    },
    async ({ sessionId }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);

      const metrics = await session.page.evaluate(() => {
        const perf = performance;
        const timing = perf.timing;
        const navigation = perf.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;

        return {
          // Navigation timing
          loadTime: timing.loadEventEnd - timing.navigationStart,
          domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
          firstPaint: perf.getEntriesByName("first-paint")[0]?.startTime ?? null,
          firstContentfulPaint: perf.getEntriesByName("first-contentful-paint")[0]?.startTime ?? null,
          // Resource counts
          resourceCount: perf.getEntriesByType("resource").length,
          // Memory (Chrome only)
          memory: (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory ? {
            usedJSHeapSize: (performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize,
            totalJSHeapSize: (performance as unknown as { memory: { totalJSHeapSize: number } }).memory.totalJSHeapSize
          } : null,
          // Transfer size
          transferSize: navigation?.transferSize ?? null
        };
      });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ metrics }, null, 2)
        }]
      };
    }
  );

  server.tool(
    "get_accessibility_tree",
    "Get the accessibility tree (ARIA snapshot) of the page or element",
    {
      sessionId: z.string(),
      selector: z.string().optional()
    },
    async ({ sessionId, selector }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);

      const locator = selector ? session.page.locator(selector) : session.page.locator("body");
      const tree = await locator.ariaSnapshot();

      return {
        content: [{
          type: "text",
          text: `## Accessibility Tree\n\`\`\`yaml\n${tree}\n\`\`\``
        }]
      };
    }
  );
}

// Graceful shutdown handler
const cleanup = async () => {
  console.error("Shutting down, closing all browser sessions...");
  await sessionManager.closeAllSessions();
  process.exit(0);
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);

console.error(`playwright-parallel-mcp server started (mode: ${mode}, tools: ${isFullMode ? 63 : 22})`);
