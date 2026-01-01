import { McpClient } from "./mcp-client.js";
import {
  BackendConfig,
  DEFAULT_BACKENDS,
  McpTool,
  McpToolCallResult,
  SessionInfo
} from "./types.js";

export interface Session {
  id: string;
  client: McpClient;
  backend: string;
  createdAt: Date;
  lastUsedAt: Date;
}

export interface CreateSessionOptions {
  backend?: string;  // "playwright" | "chrome-devtools" | カスタムコマンド
}

/**
 * セッションマネージャー - 子MCPプロセスを管理
 */
class SessionManager {
  private sessions = new Map<string, Session>();
  private maxSessions = parseInt(process.env.MAX_SESSIONS || "10", 10);
  private creating = 0;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private sessionTimeout = parseInt(process.env.SESSION_TIMEOUT_MS || "3600000", 10);
  private cachedTools: McpTool[] | null = null;
  private defaultBackend = process.env.MCP_BACKEND || "playwright";

  constructor() {
    this.startCleanupInterval();
  }

  /**
   * クリーンアップインターバルを開始
   */
  startCleanupInterval(): void {
    this.stopCleanupInterval();
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveSessions().catch(err => {
        console.error("Failed to cleanup inactive sessions:", err);
      });
    }, 300000);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * クリーンアップインターバルを停止
   */
  stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * 非アクティブなセッションをクリーンアップ
   */
  async cleanupInactiveSessions(): Promise<number> {
    const now = Date.now();
    const sessionsToClose: string[] = [];

    for (const [sessionId, session] of this.sessions) {
      const lastUsed = session.lastUsedAt.getTime();
      if (now - lastUsed > this.sessionTimeout) {
        sessionsToClose.push(sessionId);
      }
    }

    let closedCount = 0;
    for (const sessionId of sessionsToClose) {
      try {
        await this.closeSession(sessionId);
        closedCount++;
        console.error(`Session ${sessionId} closed due to inactivity`);
      } catch (err) {
        console.error(`Failed to cleanup session ${sessionId}:`, err);
      }
    }

    return closedCount;
  }

  /**
   * npmパッケージ名のバリデーション
   * @see https://github.com/npm/validate-npm-package-name
   */
  private isValidPackageName(name: string): boolean {
    // npmパッケージ名の規則: スコープ付き(@org/pkg)または通常のパッケージ名
    // 小文字、数字、ハイフン、アンダースコア、ドット、スコープ(@)のみ許可
    const packageNamePattern = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
    return packageNamePattern.test(name);
  }

  /**
   * バックエンド設定を取得
   */
  private getBackendConfig(backend: string): BackendConfig {
    // プリセットバックエンドを確認
    if (DEFAULT_BACKENDS[backend]) {
      return DEFAULT_BACKENDS[backend];
    }

    // カスタムバックエンドはnpx経由でのみ実行可能
    // セキュリティ: パッケージ名のバリデーションでコマンドインジェクションを防止
    if (!this.isValidPackageName(backend)) {
      throw new Error(
        `Invalid backend package name: "${backend}". ` +
        `Use a valid npm package name or one of: ${Object.keys(DEFAULT_BACKENDS).join(", ")}`
      );
    }

    return {
      command: "npx",
      args: [`${backend}@latest`]
    };
  }

  /**
   * 利用可能なツール一覧を取得（キャッシュ）
   */
  async getAvailableTools(): Promise<McpTool[]> {
    if (this.cachedTools) {
      return this.cachedTools;
    }

    // 一時的なクライアントを起動してツール一覧を取得
    const config = this.getBackendConfig(this.defaultBackend);
    const tempClient = new McpClient(config);

    try {
      await tempClient.start();
      this.cachedTools = tempClient.getTools();
      return this.cachedTools;
    } finally {
      await tempClient.stop();
    }
  }

  /**
   * 新しいセッションを作成
   */
  async createSession(options: CreateSessionOptions = {}): Promise<Session> {
    // 競合状態を防ぐため、先にインクリメントしてからチェック
    this.creating++;

    try {
      // セッション数チェック（creating を含めた総数）
      if (this.sessions.size + this.creating > this.maxSessions) {
        throw new Error(`Maximum number of sessions (${this.maxSessions}) reached. Close existing sessions first.`);
      }

      const backend = options.backend ?? this.defaultBackend;
      const config = this.getBackendConfig(backend);
      const client = new McpClient(config);

      await client.start();

      const now = new Date();
      const session: Session = {
        id: crypto.randomUUID(),
        client,
        backend,
        createdAt: now,
        lastUsedAt: now
      };

      // セッションをMapに追加してからexitハンドラーを登録
      // （競合状態を防ぐため、この順序が重要）
      this.sessions.set(session.id, session);

      // プロセス終了時にセッションをクリーンアップ
      client.on("exit", () => {
        if (this.sessions.has(session.id)) {
          this.sessions.delete(session.id);
          console.error(`Backend process exited for session ${session.id}`);
        }
      });

      return session;
    } finally {
      this.creating--;
    }
  }

  /**
   * セッションを閉じる
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    try {
      await session.client.stop();
    } catch (error) {
      console.error(`Error stopping client for session ${sessionId}:`, error);
    } finally {
      this.sessions.delete(sessionId);
    }
  }

  /**
   * 全セッションを閉じる
   */
  async closeAllSessions(): Promise<void> {
    const closePromises = Array.from(this.sessions.keys()).map(id =>
      this.closeSession(id).catch(err =>
        console.error(`Failed to close session ${id}:`, err)
      )
    );
    await Promise.all(closePromises);
  }

  /**
   * セッションを取得
   */
  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * 最終使用時刻を更新
   */
  updateLastUsed(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastUsedAt = new Date();
    }
  }

  /**
   * 全セッションを一覧取得
   */
  listSessions(): SessionInfo[] {
    return Array.from(this.sessions.values()).map(session => ({
      id: session.id,
      backend: session.backend,
      createdAt: session.createdAt,
      lastUsedAt: session.lastUsedAt
    }));
  }

  /**
   * ツールを呼び出し
   */
  async callTool(sessionId: string, toolName: string, args: Record<string, unknown>): Promise<McpToolCallResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    this.updateLastUsed(sessionId);
    return session.client.callTool(toolName, args);
  }

  /**
   * デフォルトバックエンドを取得
   */
  getDefaultBackend(): string {
    return this.defaultBackend;
  }
}

export const sessionManager = new SessionManager();
