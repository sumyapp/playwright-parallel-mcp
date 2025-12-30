import { chromium, firefox, webkit, Browser, BrowserContext, Page, ConsoleMessage, Request, Response } from "playwright";

export interface NetworkLog {
  id: string;
  url: string;
  method: string;
  resourceType: string;
  status?: number;
  statusText?: string;
  requestHeaders: Record<string, string>;
  responseHeaders?: Record<string, string>;
  timing: {
    startTime: string;
    endTime?: string;
    duration?: number;
  };
  failed?: boolean;
  failureText?: string;
}

export interface ConsoleLog {
  type: string;
  text: string;
  timestamp: string;
  location?: {
    url: string;
    lineNumber: number;
    columnNumber: number;
  };
}

export interface PageError {
  message: string;
  name: string;
  stack?: string;
  timestamp: string;
}

export interface PendingDialog {
  id: string;
  type: "alert" | "confirm" | "prompt" | "beforeunload";
  message: string;
  defaultValue?: string;
  timestamp: string;
  handled: boolean;
}

export interface Session {
  id: string;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  browserType: string;
  consoleLogs: ConsoleLog[];
  networkLogs: Map<string, NetworkLog>;
  pageErrors: PageError[];
  pendingDialogs: PendingDialog[];
  dialogAutoRespond: boolean;
  dialogAutoResponse: { accept: boolean; promptText?: string };
  createdAt: Date;
  lastUsedAt: Date;
}

export interface CreateSessionOptions {
  browser?: "chromium" | "firefox" | "webkit";
  headless?: boolean;
  viewport?: { width: number; height: number };
}

class SessionManager {
  private sessions = new Map<string, Session>();
  private maxConsoleLogs = 1000;
  private maxNetworkLogs = 500;
  private maxSessions = parseInt(process.env.MAX_SESSIONS || "10", 10);
  private requestToLogId = new WeakMap<Request, string>();
  private creating = 0;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private sessionTimeout = parseInt(process.env.SESSION_TIMEOUT_MS || "3600000", 10);

  constructor() {
    this.startCleanupInterval();
  }

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

  stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

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

  async createSession(options: CreateSessionOptions = {}): Promise<Session> {
    if (this.sessions.size + this.creating >= this.maxSessions) {
      throw new Error(`Maximum number of sessions (${this.maxSessions}) reached. Close existing sessions first.`);
    }

    this.creating++;

    try {
      const browserType = options.browser ?? "chromium";
      const headless = options.headless ?? true;
      const viewport = options.viewport ?? { width: 1280, height: 720 };

      const launcher = browserType === "firefox" ? firefox : browserType === "webkit" ? webkit : chromium;
      const browser = await launcher.launch({ headless });

      const context = await browser.newContext({ viewport });
      const page = await context.newPage();

      const now = new Date();
      const session: Session = {
        id: crypto.randomUUID(),
        browser,
        context,
        page,
        browserType,
        consoleLogs: [],
        networkLogs: new Map<string, NetworkLog>(),
        pageErrors: [],
        pendingDialogs: [],
        dialogAutoRespond: true,
        dialogAutoResponse: { accept: true },
        createdAt: now,
        lastUsedAt: now
      };

      browser.on("disconnected", () => {
        if (this.sessions.has(session.id)) {
          this.cleanupSessionListeners(session);
          this.sessions.delete(session.id);
          console.error(`Browser disconnected unexpectedly for session ${session.id}`);
        }
      });

      page.on("console", (msg: ConsoleMessage) => {
        const log: ConsoleLog = {
          type: this.mapConsoleType(msg.type()),
          text: msg.text(),
          timestamp: new Date().toISOString(),
          location: msg.location() ? {
            url: msg.location().url,
            lineNumber: msg.location().lineNumber,
            columnNumber: msg.location().columnNumber
          } : undefined
        };

        session.consoleLogs.push(log);

        if (session.consoleLogs.length > this.maxConsoleLogs) {
          session.consoleLogs.shift();
        }
      });

      page.on("request", (request: Request) => {
        const logId = crypto.randomUUID();
        this.requestToLogId.set(request, logId);

        const networkLog: NetworkLog = {
          id: logId,
          url: request.url(),
          method: request.method(),
          resourceType: request.resourceType(),
          requestHeaders: request.headers(),
          timing: {
            startTime: new Date().toISOString()
          }
        };

        session.networkLogs.set(logId, networkLog);

        if (session.networkLogs.size > this.maxNetworkLogs) {
          const firstKey = session.networkLogs.keys().next().value;
          if (firstKey) {
            session.networkLogs.delete(firstKey);
          }
        }
      });

      page.on("response", (response: Response) => {
        const request = response.request();
        const logId = this.requestToLogId.get(request);

        if (logId) {
          const networkLog = session.networkLogs.get(logId);
          if (networkLog) {
            const endTime = new Date();
            const startTime = new Date(networkLog.timing.startTime);

            networkLog.status = response.status();
            networkLog.statusText = response.statusText();
            networkLog.responseHeaders = response.headers();
            networkLog.timing.endTime = endTime.toISOString();
            networkLog.timing.duration = endTime.getTime() - startTime.getTime();
          }
        }
      });

      page.on("requestfailed", (request: Request) => {
        const logId = this.requestToLogId.get(request);

        if (logId) {
          const networkLog = session.networkLogs.get(logId);
          if (networkLog) {
            const endTime = new Date();
            const startTime = new Date(networkLog.timing.startTime);

            networkLog.failed = true;
            networkLog.failureText = request.failure()?.errorText;
            networkLog.timing.endTime = endTime.toISOString();
            networkLog.timing.duration = endTime.getTime() - startTime.getTime();
          }
        }
      });

      page.on("pageerror", (error: Error) => {
        const pageError: PageError = {
          message: error.message,
          name: error.name,
          stack: error.stack,
          timestamp: new Date().toISOString()
        };

        session.pageErrors.push(pageError);

        if (session.pageErrors.length > this.maxConsoleLogs) {
          session.pageErrors.shift();
        }
      });

      page.on("dialog", async (dialog) => {
        const pendingDialog: PendingDialog = {
          id: crypto.randomUUID(),
          type: dialog.type() as PendingDialog["type"],
          message: dialog.message(),
          defaultValue: dialog.defaultValue(),
          timestamp: new Date().toISOString(),
          handled: false
        };

        session.pendingDialogs.push(pendingDialog);

        if (session.dialogAutoRespond) {
          if (session.dialogAutoResponse.accept) {
            await dialog.accept(session.dialogAutoResponse.promptText);
          } else {
            await dialog.dismiss();
          }
          pendingDialog.handled = true;
        }

        if (session.pendingDialogs.length > 100) {
          session.pendingDialogs.shift();
        }
      });

      this.sessions.set(session.id, session);
      return session;
    } finally {
      this.creating--;
    }
  }

  private cleanupSessionListeners(session: Session): void {
    try {
      session.page.removeAllListeners("console");
      session.page.removeAllListeners("request");
      session.page.removeAllListeners("response");
      session.page.removeAllListeners("requestfailed");
      session.page.removeAllListeners("pageerror");
      session.page.removeAllListeners("dialog");
    } catch {
      // ページが既に閉じている場合は無視
    }

    session.consoleLogs.length = 0;
    session.networkLogs.clear();
    session.pageErrors.length = 0;
    session.pendingDialogs.length = 0;
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    this.cleanupSessionListeners(session);

    try {
      await session.browser.close();
    } catch (error) {
      console.error(`Error closing browser for session ${sessionId}:`, error);
    } finally {
      this.sessions.delete(sessionId);
    }
  }

  async closeAllSessions(): Promise<void> {
    const closePromises = Array.from(this.sessions.keys()).map(id =>
      this.closeSession(id).catch(err =>
        console.error(`Failed to close session ${id}:`, err)
      )
    );
    await Promise.all(closePromises);
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  updateLastUsed(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastUsedAt = new Date();
    }
  }

  listSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  private mapConsoleType(type: string): string {
    const typeMap: Record<string, string> = {
      "log": "log",
      "info": "info",
      "warning": "warn",
      "error": "error",
      "debug": "debug",
      "trace": "trace"
    };
    return typeMap[type] || "log";
  }
}

export const sessionManager = new SessionManager();
