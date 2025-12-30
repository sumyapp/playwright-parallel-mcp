# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

複数のAIエージェントが同時に独立したブラウザインスタンスを制御できるMCP（Model Context Protocol）サーバー。既存のブラウザ自動化MCPサーバーがセッション間でブラウザを共有する問題を解決し、各セッションに分離されたブラウザインスタンスを提供する。

## 開発コマンド

```bash
pnpm install          # 依存関係インストール
pnpm build            # tsupでビルド（dist/へ出力）
pnpm dev              # ウォッチモードでビルド
pnpm start            # ビルド済みサーバーを起動
pnpm test             # vitestでテスト実行
pnpm typecheck        # TypeScript型チェック
```

## アーキテクチャ

```
src/
├── index.ts           # MCPサーバーエントリポイント、全ツール定義
└── session-manager.ts # ブラウザセッション管理（シングルトン）
```

### コア設計

- **SessionManager（シングルトン）**: `Map<string, Session>`でセッションを管理。各セッションは独立したBrowser、BrowserContext、Pageを持つ
- **Session**: ブラウザインスタンス、コンソールログ（最大1000件保持）、メタデータを保持
- **MCPツール**: `@modelcontextprotocol/sdk`の`server.tool()`でツールを定義。Zodスキーマで引数を検証

### ツール追加パターン

`src/index.ts`に以下の形式で追加：

```typescript
server.tool(
  "tool_name",
  "Tool description",
  {
    // Zodスキーマで引数定義
    sessionId: z.string(),
    param: z.string().optional()
  },
  async ({ sessionId, param }) => {
    const session = sessionManager.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    // 処理
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);
```

## 技術スタック

- TypeScript (ES2022, ESM)
- tsup（バンドル、`#!/usr/bin/env node` shebang自動付与）
- Playwright（Chromium/Firefox/WebKit）
- MCP SDK（stdio transport）
- Zod（スキーマ検証）
- Vitest（テスト）
