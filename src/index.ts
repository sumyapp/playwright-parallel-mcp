import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { sessionManager } from "./session-manager.js";
import { McpTool, DEFAULT_BACKENDS } from "./types.js";

const server = new McpServer({
  name: "playwright-parallel-mcp",
  version: "0.3.0"
});

// === Session Management Tools (always registered) ===

server.tool(
  "create_session",
  "Create a new isolated browser session. Each session runs an independent MCP backend process.",
  {
    backend: z.string().optional().describe(
      `Backend MCP server to use. Options: ${Object.keys(DEFAULT_BACKENDS).join(", ")} or any npm package name`
    )
  },
  async ({ backend }) => {
    try {
      const session = await sessionManager.createSession({ backend });
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            sessionId: session.id,
            backend: session.backend,
            createdAt: session.createdAt.toISOString(),
            message: "Session created successfully. Use this sessionId for subsequent tool calls."
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error creating session: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);

server.tool(
  "close_session",
  "Close a browser session and terminate its backend process",
  {
    sessionId: z.string().describe("The session ID to close")
  },
  async ({ sessionId }) => {
    try {
      await sessionManager.closeSession(sessionId);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: true, message: `Session ${sessionId} closed` })
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error closing session: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
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
          count: sessions.length,
          sessions: sessions.map(s => ({
            sessionId: s.id,
            backend: s.backend,
            createdAt: s.createdAt.toISOString(),
            lastUsedAt: s.lastUsedAt.toISOString()
          }))
        }, null, 2)
      }]
    };
  }
);

// === Dynamic Tool Registration ===

/**
 * バックエンドツールをラップして登録
 */
function registerBackendTool(tool: McpTool): void {
  // inputSchema に sessionId を追加
  const wrappedSchema: Record<string, z.ZodTypeAny> = {
    sessionId: z.string().describe("The session ID to use for this operation")
  };

  // 元のスキーマのプロパティを追加
  if (tool.inputSchema.properties) {
    for (const [key, value] of Object.entries(tool.inputSchema.properties)) {
      const prop = value as { type?: string; description?: string; enum?: string[]; default?: unknown };

      // Zod スキーマに変換
      let zodSchema: z.ZodTypeAny;

      switch (prop.type) {
        case "string":
          zodSchema = prop.enum
            ? z.enum(prop.enum as [string, ...string[]])
            : z.string();
          break;
        case "number":
        case "integer":
          zodSchema = z.number();
          break;
        case "boolean":
          zodSchema = z.boolean();
          break;
        case "array":
          zodSchema = z.array(z.unknown());
          break;
        case "object":
          zodSchema = z.record(z.unknown());
          break;
        default:
          zodSchema = z.unknown();
      }

      // 説明を追加
      if (prop.description) {
        zodSchema = zodSchema.describe(prop.description);
      }

      // オプショナルかどうか
      const isRequired = tool.inputSchema.required?.includes(key);
      if (!isRequired) {
        zodSchema = zodSchema.optional();
      }

      wrappedSchema[key] = zodSchema;
    }
  }

  // ツールを登録
  server.tool(
    tool.name,
    tool.description || `Wrapped tool: ${tool.name}`,
    wrappedSchema,
    async (args) => {
      const { sessionId, ...toolArgs } = args as { sessionId: string; [key: string]: unknown };

      try {
        const result = await sessionManager.callTool(sessionId, tool.name, toolArgs);
        // MCP SDKが期待する型に変換
        const content = result.content.map(c => {
          if (c.type === "image" && c.data && c.mimeType) {
            return { type: "image" as const, data: c.data, mimeType: c.mimeType };
          }
          return { type: "text" as const, text: c.text || "" };
        });
        return {
          content,
          isError: result.isError
        };
      } catch (error) {
        return {
          content: [{
            type: "text" as const,
            text: `Error calling ${tool.name}: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );
}

/**
 * バックエンドからツールを取得して登録
 */
async function registerBackendTools(): Promise<number> {
  try {
    const tools = await sessionManager.getAvailableTools();
    let registeredCount = 0;

    for (const tool of tools) {
      try {
        registerBackendTool(tool);
        registeredCount++;
      } catch (error) {
        console.error(`Failed to register tool ${tool.name}:`, error);
      }
    }

    return registeredCount;
  } catch (error) {
    console.error("Failed to get backend tools:", error);
    return 0;
  }
}

// === Server Startup ===

async function main() {
  const backend = sessionManager.getDefaultBackend();

  // バックエンドツールを登録
  const toolCount = await registerBackendTools();

  // 3つのセッション管理ツール + バックエンドツール
  const totalTools = 3 + toolCount;

  console.error(`playwright-parallel-mcp server started`);
  console.error(`  Backend: ${backend}`);
  console.error(`  Tools: ${totalTools} (3 session + ${toolCount} backend)`);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // グレースフルシャットダウン
  const shutdown = async () => {
    console.error("Shutting down...");
    await sessionManager.closeAllSessions();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
