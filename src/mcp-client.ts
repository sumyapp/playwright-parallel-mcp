import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import {
  JsonRpcRequest,
  JsonRpcResponse,
  McpTool,
  McpToolsListResult,
  McpToolCallResult,
  BackendConfig
} from "./types.js";

/**
 * MCPクライアント - 子プロセスとしてMCPサーバーを起動し、通信を行う
 */
export class McpClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number | string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }>();
  private buffer = "";
  private tools: McpTool[] = [];
  private initialized = false;

  constructor(private config: BackendConfig) {
    super();
  }

  /**
   * MCPサーバーを起動して初期化
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const env = { ...process.env, ...this.config.env };

      this.process = spawn(this.config.command, this.config.args, {
        stdio: ["pipe", "pipe", "pipe"],
        env
      });

      this.process.stdout?.on("data", (data: Buffer) => {
        this.handleData(data.toString());
      });

      this.process.stderr?.on("data", (data: Buffer) => {
        // stderrはログとして出力（MCPサーバーのログ）
        const message = data.toString().trim();
        if (message) {
          // 起動成功の確認
          if (message.includes("started") || message.includes("listening")) {
            if (!this.initialized) {
              this.initialized = true;
              this.initializeSession().then(resolve).catch(reject);
            }
          }
        }
      });

      this.process.on("error", (error) => {
        reject(error);
      });

      this.process.on("exit", (code) => {
        this.emit("exit", code);
        // 全ての保留中のリクエストを拒否
        // 競合状態を防ぐため、deleteしてからrejectする
        for (const [id, pending] of this.pendingRequests) {
          this.pendingRequests.delete(id);
          pending.reject(new Error(`Process exited with code ${code}`));
        }
      });

      // タイムアウト - 起動メッセージがない場合でも初期化を試みる
      setTimeout(() => {
        if (!this.initialized) {
          this.initialized = true;
          this.initializeSession().then(resolve).catch(reject);
        }
      }, 2000);
    });
  }

  /**
   * MCPセッションを初期化
   */
  private async initializeSession(): Promise<void> {
    // initialize を送信
    await this.sendRequest("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "playwright-parallel-mcp",
        version: "0.3.0"
      }
    });

    // initialized 通知を送信
    this.sendNotification("notifications/initialized", {});

    // ツール一覧を取得
    const result = await this.sendRequest("tools/list", {}) as McpToolsListResult;
    this.tools = result.tools || [];
  }

  /**
   * 受信データを処理
   */
  private handleData(data: string): void {
    this.buffer += data;

    // 改行で分割してJSON-RPCメッセージを処理
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const message = JSON.parse(trimmed) as JsonRpcResponse;
        this.handleMessage(message);
      } catch {
        // JSON解析エラーは無視
      }
    }
  }

  /**
   * JSON-RPCメッセージを処理
   */
  private handleMessage(message: JsonRpcResponse): void {
    if (message.id !== undefined) {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        this.pendingRequests.delete(message.id);
        if (message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message.result);
        }
      }
    }
  }

  /**
   * JSON-RPCリクエストを送信
   */
  async sendRequest(method: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.process?.stdin) {
      throw new Error("Process not started");
    }

    const id = ++this.requestId;
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.process!.stdin!.write(JSON.stringify(request) + "\n");

      // タイムアウト
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, 30000);
    });
  }

  /**
   * JSON-RPC通知を送信（レスポンスを待たない）
   */
  sendNotification(method: string, params: Record<string, unknown>): void {
    if (!this.process?.stdin) {
      return;
    }

    const notification = {
      jsonrpc: "2.0",
      method,
      params
    };

    this.process.stdin.write(JSON.stringify(notification) + "\n");
  }

  /**
   * ツール一覧を取得
   */
  getTools(): McpTool[] {
    return this.tools;
  }

  /**
   * ツールを呼び出し
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<McpToolCallResult> {
    const result = await this.sendRequest("tools/call", {
      name,
      arguments: args
    });
    return result as McpToolCallResult;
  }

  /**
   * プロセスを停止
   */
  async stop(): Promise<void> {
    // 先にpendingRequestsをrejectしてからクリア（exitイベントより先に処理）
    for (const [id, pending] of this.pendingRequests) {
      this.pendingRequests.delete(id);
      pending.reject(new Error("Process stopped"));
    }

    if (this.process) {
      // stdinを適切にクローズしてリソースリークを防止
      if (this.process.stdin && !this.process.stdin.destroyed) {
        this.process.stdin.end();
      }
      this.process.kill();
      this.process = null;
    }
  }

  /**
   * プロセスが実行中かどうか
   */
  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }
}
