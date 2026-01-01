# playwright-parallel-mcp

[![CI](https://github.com/sumyapp/playwright-parallel-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/sumyapp/playwright-parallel-mcp/actions/workflows/ci.yml)
[![Coverage Status](https://coveralls.io/repos/github/sumyapp/playwright-parallel-mcp/badge.svg?branch=main)](https://coveralls.io/github/sumyapp/playwright-parallel-mcp?branch=main)
[![npm version](https://badge.fury.io/js/playwright-parallel-mcp.svg)](https://www.npmjs.com/package/playwright-parallel-mcp)

[English](README.md) | **[日本語](README.ja.md)** | [中文](README.zh.md)

複数のAIエージェントが**独立したブラウザインスタンス**を並列で制御できるMCP（Model Context Protocol）サーバーです。

## セキュリティ警告

> **このMCPサーバーは、信頼できない相手に公開されると悪用される可能性のある強力なブラウザ自動化機能を提供します。**

- **`run_script`**: ブラウザコンテキストで任意のJavaScriptを実行
- **`upload_file`**: ファイルアップロードのためファイルシステムにアクセス
- **`generate_pdf`** / **`add_init_script`**: （Fullモードのみ）追加のファイルシステムアクセスとスクリプト挿入機能

**信頼できないユーザーやAIエージェントにこのサーバーを公開しないでください。** 接続可能なすべてのクライアントを信頼できる、管理された環境でのみ使用してください。

## 課題

既存のブラウザ自動化MCPサーバー（Chrome DevTools MCP、Playwright MCP）は、すべてのセッションで単一のブラウザインスタンスを共有するため、複数のAIエージェントが同時に使用しようとすると競合が発生します。

## 解決策

playwright-parallel-mcpは**各セッションに分離されたブラウザインスタンス**を作成し、真の並列ブラウザ自動化を実現します。

## セッション分離保証

**各セッションは100%分離されています。** これはアーキテクチャレベルで保証され、包括的なテストで検証されています。

### アーキテクチャ

```
セッションA                  セッションB                  セッションC
    │                            │                            │
    ▼                            ▼                            ▼
┌─────────┐                ┌─────────┐                ┌─────────┐
│ブラウザ │                │ブラウザ │                │ブラウザ │
│プロセス │                │プロセス │                │プロセス │
│  (OS)   │                │  (OS)   │                │  (OS)   │
└────┬────┘                └────┬────┘                └────┬────┘
     │                          │                          │
     ▼                          ▼                          ▼
┌─────────┐                ┌─────────┐                ┌─────────┐
│コンテキスト│              │コンテキスト│              │コンテキスト│
│(Cookie) │                │(Cookie) │                │(Cookie) │
└────┬────┘                └────┬────┘                └────┬────┘
     │                          │                          │
     ▼                          ▼                          ▼
┌─────────┐                ┌─────────┐                ┌─────────┐
│ ページ  │                │ ページ  │                │ ページ  │
│ (DOM)   │                │ (DOM)   │                │ (DOM)   │
└─────────┘                └─────────┘                └─────────┘
```

### 分離されるリソース

| リソース | 分離? | 方法 |
|----------|-------|------|
| ブラウザプロセス | ✅ はい | セッションごとに独立したOSプロセス |
| Cookie | ✅ はい | 独立したBrowserContext |
| localStorage | ✅ はい | 独立したBrowserContext |
| sessionStorage | ✅ はい | 独立したBrowserContext |
| DOM | ✅ はい | 独立したPageインスタンス |
| ナビゲーション履歴 | ✅ はい | 独立したPageインスタンス |
| コンソールログ | ✅ はい | セッションごとに保存 |
| ネットワークログ | ✅ はい | セッションごとに保存 |

### テストカバレッジ

セッション分離は**17の専用テスト**で検証されています：

- ブラウザプロセスの分離
- ナビゲーションの分離
- DOMの分離
- Cookieの分離
- localStorage/sessionStorageの分離
- コンソールログの分離
- ネットワークログの分離
- 並行操作の安全性
- セッションIDの一意性（UUID v4）

`pnpm test`を実行して分離保証を確認できます。

## 特徴

- **並列セッション** - 各セッションが独自のブラウザインスタンスを持つ
- **複数ブラウザ対応** - Chromium、Firefox、WebKitをサポート
- **22種類のツール** - 必須のブラウザ自動化機能（Fullモードでは63種類）
- **低コンテキスト使用量** - 約14kトークン（@playwright/mcpと同等）
- **コンソールログ** - デバッグ用にコンソール出力をキャプチャ
- **ダイアログ処理** - alert、confirm、promptダイアログを処理
- **アクセシビリティスナップショット** - ARIAスナップショット形式（Playwright 1.49以降）
- **無料＆ローカル** - クラウドサービス不要

## インストール

### Claude Codeで使用

MCP設定に追加：

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

### npmで使用

```bash
npm install -g playwright-parallel-mcp
playwright-parallel-mcp
```

## 利用可能なツール（22種類）

### セッション管理（3ツール）
| ツール | 説明 |
|------|------|
| `create_session` | 新しい分離されたブラウザセッションを作成（chromium/firefox/webkit） |
| `close_session` | ブラウザセッションを閉じる |
| `list_sessions` | すべてのアクティブなセッションを一覧表示 |

### ナビゲーション（4ツール）
| ツール | 説明 |
|------|------|
| `navigate` | URLに移動 |
| `go_back` | ブラウザ履歴を戻る |
| `reload` | 現在のページを再読み込み |
| `get_url` | 現在のURLとページタイトルを取得 |

### ページ検査（2ツール）
| ツール | 説明 |
|------|------|
| `snapshot` | アクセシビリティツリーを取得（ARIAスナップショット形式） |
| `screenshot` | スクリーンショットを撮影（PNG/JPEG、フルページまたは要素） |

### ユーザー操作（6ツール）
| ツール | 説明 |
|------|------|
| `click` | 要素をクリック（左/右/中央ボタン） |
| `fill` | フォーム入力にテキストを入力 |
| `type` | リアルなキー入力でテキストを入力 |
| `press_key` | キーボードキーを押す（例：Enter、Control+A） |
| `hover` | 要素にホバー |
| `select_option` | ドロップダウンから選択 |

### その他のツール（7ツール）
| ツール | 説明 |
|------|------|
| `wait_for_timeout` | 指定時間待機 |
| `set_dialog_handler` | 自動ダイアログ処理を設定（承諾/却下） |
| `upload_file` | ファイル入力要素にファイルをアップロード |
| `drag_and_drop` | 要素をドラッグして別の要素にドロップ |
| `run_script` | ブラウザコンテキストでJavaScriptを実行 |
| `get_console_logs` | コンソールログを取得（log/info/warn/error/debug） |
| `set_viewport` | ビューポートサイズを変更 |

## 使用例

### 基本的なナビゲーション

```
ユーザー: example.comを開いてスクリーンショットを撮って

Claude: ブラウザセッションを作成し、example.comに移動します。

[create_session] -> sessionId: "abc123"
[navigate sessionId="abc123" url="https://example.com"]
[screenshot sessionId="abc123"]
```

### 並列セッション

```
ユーザー: 2つのウェブサイトのホームページを並べて比較して

Claude: 2つのブラウザセッションを並列で作成します。

[create_session] -> sessionId: "session-a"
[create_session] -> sessionId: "session-b"
[navigate sessionId="session-a" url="https://example.com"]
[navigate sessionId="session-b" url="https://google.com"]
[snapshot sessionId="session-a"]
[snapshot sessionId="session-b"]
```

### フォーム操作

```
ユーザー: ログインフォームに入力して

Claude: フォームフィールドに入力して送信します。

[fill sessionId="abc123" selector="input[name='email']" value="user@example.com"]
[fill sessionId="abc123" selector="input[name='password']" value="***"]
[click sessionId="abc123" selector="button[type='submit']"]
```

### コンソールログ

```
ユーザー: ページのコンソール出力をチェックして

Claude: コンソールログとエラーを確認します。

[get_console_logs sessionId="abc123" types=["error", "warn"]]
```

### ダイアログ処理

```
ユーザー: 確認ダイアログを処理して

Claude: 自動ダイアログ処理を設定します。

[set_dialog_handler sessionId="abc123" autoRespond=true accept=true]
[click sessionId="abc123" selector="#delete-button"]
```

## ツールリファレンス

### create_session

新しい分離されたブラウザセッションを作成します。

**パラメータ:**
- `browser`（オプション）: "chromium" | "firefox" | "webkit"（デフォルト: "chromium"）
- `headless`（オプション）: boolean（デフォルト: true）
- `viewport`（オプション）: { width: number, height: number }

**戻り値:** `{ sessionId, browser, createdAt }`

### navigate

URLに移動します。

**パラメータ:**
- `sessionId`: string
- `url`: string（有効なURL）
- `waitUntil`（オプション）: "load" | "domcontentloaded" | "networkidle"（デフォルト: "load"）

**戻り値:** `{ url, title, status }`

### snapshot

ARIAスナップショット形式でアクセシビリティツリーを取得します。

**パラメータ:**
- `sessionId`: string

**戻り値:** YAML形式のアクセシビリティツリー

### run_script

ブラウザコンテキストでJavaScriptを実行します。

**パラメータ:**
- `sessionId`: string
- `expression`: 評価するJavaScript式

**戻り値:** `{ success: boolean, result?: any, error?: string }`

## 比較

| 機能 | Chrome DevTools MCP | Playwright MCP | **本プロジェクト** |
|------|---------------------|----------------|-------------------|
| 並列セッション | なし | なし | **あり** |
| セッション分離 | なし | なし | **あり（APIレベル）** |
| ツール数 | 約26 | 約22 | **22（Lite）/ 63（Full）** |
| コンテキストトークン | 約17k | 約14k | **約14k（Lite）/ 約40k（Full）** |
| コンソールログ | あり | あり | **あり** |
| ダイアログ処理 | あり | なし | **あり** |
| JavaScript実行 | あり | あり | **あり** |
| ファイルアップロード | なし | あり | **あり** |
| 料金 | 無料 | 無料 | **無料** |

### コンテキストトークン使用量（実測値）

Claude Codeで MCP ツールとして読み込んだ際のトークン消費量（`/context` コマンド）：

| MCPサーバー | ツール数 | 総トークン | 平均/ツール |
|------------|---------|-----------|------------|
| **playwright-parallel-mcp (Lite)** | 22 | 約14,000 | 640 |
| **playwright-parallel-mcp (Full)** | 63 | 40,343 | 640 |
| [@playwright/mcp](https://github.com/microsoft/playwright-mcp) | 22 | 14,534 | 661 |
| [chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp) | 26 | 17,668 | 680 |

> **Liteモード（デフォルト）** は@playwright/mcpと同じツール数で同等のトークン使用量を提供しながら、並列実行のためのセッション分離を追加しています。

## 環境変数

| 変数 | デフォルト値 | 説明 |
|------|-------------|------|
| `PLAYWRIGHT_PARALLEL_MODE` | `lite` | モード: `lite`（22ツール）または `full`（63ツール） |
| `MAX_SESSIONS` | 10 | 同時ブラウザセッションの最大数 |
| `SESSION_TIMEOUT_MS` | 3600000 | セッション非アクティブタイムアウト（1時間） |

## 要件

- Node.js 20以上
- Playwrightブラウザ（自動インストール）

## 開発

```bash
git clone https://github.com/sumyapp/playwright-parallel-mcp
cd playwright-parallel-mcp
pnpm install
pnpm build
pnpm start
```

### テスト実行

```bash
pnpm test
```

### プロジェクト構造

```
src/
  index.ts          # MCPサーバーエントリポイント、全ツール定義
  session-manager.ts # ブラウザセッションライフサイクル管理
```

## Fullモード

Fullモードは**`run_script`では代替できない**機能を提供し、特定のユースケースに不可欠です。

### Fullモードを使用すべき場合

| ユースケース | 必要なツール | run_scriptで代替できない理由 |
|-------------|-------------|----------------------------|
| **API監視** | `get_network_logs` | ヘッダー、タイミング、ステータスコードを含むすべてのHTTPリクエスト/レスポンスをキャプチャ |
| **パフォーマンス分析** | `get_metrics` | Navigation Timing API、メモリ使用量、ペイントメトリクスへのアクセス |
| **PDFレポート生成** | `generate_pdf` | ページフォーマットオプション付きのブラウザレベルPDFレンダリング |
| **iframe自動化** | `frame_click`, `frame_fill` | JavaScriptからアクセスできないクロスオリジンiframeへのアクセス |
| **JSエラー検出** | `get_page_errors` | 失われる前にキャッチされない例外をキャプチャ |
| **アクセシビリティ監査** | `get_accessibility_tree` | コンプライアンステスト用の完全なARIAツリー構造 |

### 例：ネットワークログを使用したAPIテスト

```
ユーザー: ログインAPIをテストしてレスポンスを確認して

Claude: ログイン中のネットワークリクエストを監視します。

[get_network_logs sessionId="abc" resourceTypes=["fetch","xhr"]]
→ キャプチャ: POST /api/login (200, 145ms, レスポンスボディあり)
```

これが`run_script`では不可能な理由：
- Fetch/XHRのインターセプトはリクエスト前にセットアップが必要
- レスポンスボディは完了後にアクセス不可
- タイミング情報は失われる

### 設定

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

### 追加ツール（41ツール、約40kトークン）

<details>
<summary>クリックして全ツールリストを展開</summary>

- **ナビゲーション**: go_forward
- **ページ検査**: get_content, get_html
- **ユーザー操作**: check, uncheck
- **待機ツール**: wait_for_selector, wait_for_load_state, wait_for_url, wait_for_function
- **ダイアログ**: get_dialogs
- **要素状態**: get_element_state, get_attribute, get_bounding_box, count_elements, get_all_texts
- **スクロール**: scroll, scroll_into_view
- **マウス**: mouse_move, mouse_click, mouse_down, mouse_up, mouse_wheel
- **エミュレーション**: set_geolocation, set_offline, set_extra_http_headers
- **ストレージ/Cookie**: get_cookies, set_cookies, get_storage, set_storage
- **ネットワーク**: get_network_logs
- **PDF/フレーム**: generate_pdf, list_frames, frame_click, frame_fill, frame_get_content
- **デバッグ**: get_page_errors, clear_logs, expose_function, add_init_script, get_metrics, get_accessibility_tree

</details>

## ライセンス

MIT
