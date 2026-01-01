// MCP Protocol Types

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

export interface McpToolsListResult {
  tools: McpTool[];
}

export interface McpToolCallResult {
  content: Array<{
    type: string;
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

export interface SessionInfo {
  id: string;
  backend: string;
  createdAt: Date;
  lastUsedAt: Date;
}

export interface BackendConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

// デフォルトのバックエンド設定
export const DEFAULT_BACKENDS: Record<string, BackendConfig> = {
  "playwright": {
    command: "npx",
    args: ["@playwright/mcp@latest"]
  },
  "chrome-devtools": {
    command: "npx",
    args: ["chrome-devtools-mcp@latest"]
  }
};
