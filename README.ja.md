# playwright-parallel-mcp

[English](README.md) | **[日本語](README.ja.md)** | [中文](README.zh.md)

複数のAIエージェントが**独立したブラウザインスタンス**を並列で制御できるMCP（Model Context Protocol）サーバーです。

## セキュリティ警告

> **このMCPサーバーは、信頼できない相手に公開されると悪用される可能性のある強力なブラウザ自動化機能を提供します。**

- **`run_script`**: ブラウザコンテキストで任意のJavaScriptを実行
- **`generate_pdf`** / **`upload_file`**: ファイルシステムへの読み書きアクセス
- **`add_init_script`**: ページロード時に実行されるスクリプトを挿入

**信頼できないユーザーやAIエージェントにこのサーバーを公開しないでください。** 接続可能なすべてのクライアントを信頼できる、管理された環境でのみ使用してください。

## 課題

既存のブラウザ自動化MCPサーバー（Chrome DevTools MCP、Playwright MCP）は、すべてのセッションで単一のブラウザインスタンスを共有するため、複数のAIエージェントが同時に使用しようとすると競合が発生します。

## 解決策

playwright-parallel-mcpは**各セッションに分離されたブラウザインスタンス**を作成し、真の並列ブラウザ自動化を実現します。

## 特徴

- **並列セッション** - 各セッションが独自のブラウザインスタンスを持つ
- **複数ブラウザ対応** - Chromium、Firefox、WebKitをサポート
- **63種類のツール** - 包括的なブラウザ自動化機能
- **コンソール・ネットワークログ** - 完全なデバッグサポート
- **JSエラー検出** - JavaScriptエラーをキャプチャ
- **ダイアログ処理** - alert、confirm、promptダイアログを処理
- **パフォーマンスメトリクス** - タイミングとメモリのメトリクス取得
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

## 利用可能なツール（全63種類）

### セッション管理（3ツール）
| ツール | 説明 |
|------|------|
| `create_session` | 新しい分離されたブラウザセッションを作成（chromium/firefox/webkit） |
| `close_session` | ブラウザセッションを閉じる |
| `list_sessions` | すべてのアクティブなセッションを一覧表示 |

### ナビゲーション（5ツール）
| ツール | 説明 |
|------|------|
| `navigate` | URLに移動 |
| `go_back` | ブラウザ履歴を戻る |
| `go_forward` | ブラウザ履歴を進む |
| `reload` | 現在のページを再読み込み |
| `get_url` | 現在のURLとページタイトルを取得 |

### ページ検査（4ツール）
| ツール | 説明 |
|------|------|
| `snapshot` | アクセシビリティツリーを取得（ARIAスナップショット形式） |
| `screenshot` | スクリーンショットを撮影（PNG/JPEG、フルページまたは要素） |
| `get_content` | ページまたは要素のテキストコンテンツを取得 |
| `get_html` | ページまたは要素のHTMLを取得 |

### ユーザー操作（8ツール）
| ツール | 説明 |
|------|------|
| `click` | 要素をクリック（左/右/中央ボタン） |
| `fill` | フォーム入力にテキストを入力 |
| `select_option` | ドロップダウンから選択 |
| `hover` | 要素にホバー |
| `press_key` | キーボードキーを押す（例：Enter、Control+A） |
| `type` | リアルなキー入力でテキストを入力 |
| `check` | チェックボックスをオン |
| `uncheck` | チェックボックスをオフ |

### 待機ツール（5ツール）
| ツール | 説明 |
|------|------|
| `wait_for_selector` | 要素の出現/消滅を待機 |
| `wait_for_load_state` | ページロード状態を待機（load/domcontentloaded/networkidle） |
| `wait_for_url` | URLがパターンに一致するまで待機 |
| `wait_for_function` | JavaScript条件がtrueになるまで待機 |
| `wait_for_timeout` | 指定時間待機 |

### ダイアログツール（2ツール）
| ツール | 説明 |
|------|------|
| `get_dialogs` | セッションからダイアログ履歴を取得 |
| `set_dialog_handler` | 自動ダイアログ処理を設定（承諾/却下） |

### 要素状態ツール（5ツール）
| ツール | 説明 |
|------|------|
| `get_element_state` | 要素の状態を取得（visible、enabled、checked、editable） |
| `get_attribute` | 要素から属性値を取得 |
| `get_bounding_box` | 要素のバウンディングボックスを取得 |
| `count_elements` | セレクタに一致する要素数をカウント |
| `get_all_texts` | 一致するすべての要素からテキストを取得 |

### ファイル/ドラッグ/スクロールツール（4ツール）
| ツール | 説明 |
|------|------|
| `upload_file` | ファイル入力要素にファイルをアップロード |
| `drag_and_drop` | 要素をドラッグして別の要素にドロップ |
| `scroll` | ページまたは要素をスクロール |
| `scroll_into_view` | 要素を表示範囲にスクロール |

### マウスツール（5ツール）
| ツール | 説明 |
|------|------|
| `mouse_move` | 特定の座標にマウスを移動 |
| `mouse_click` | 特定の座標でクリック |
| `mouse_down` | マウスボタンを押下 |
| `mouse_up` | マウスボタンを解放 |
| `mouse_wheel` | マウスホイールでスクロール |

### エミュレーションツール（4ツール）
| ツール | 説明 |
|------|------|
| `set_viewport` | ビューポートサイズを変更 |
| `set_geolocation` | ブラウザコンテキストの位置情報を設定 |
| `set_offline` | ブラウザのオフライン/オンラインモードを設定 |
| `set_extra_http_headers` | すべてのリクエストに追加HTTPヘッダーを設定 |

### PDF/フレームツール（5ツール）
| ツール | 説明 |
|------|------|
| `generate_pdf` | 現在のページのPDFを生成（Chromiumのみ） |
| `list_frames` | ページ内のすべてのフレームを一覧表示 |
| `frame_click` | フレーム内の要素をクリック |
| `frame_fill` | フレーム内の入力に入力 |
| `frame_get_content` | フレーム内の要素からテキストを取得 |

### デバッグツール（6ツール）
| ツール | 説明 |
|------|------|
| `get_page_errors` | ページからJavaScriptエラーを取得 |
| `clear_logs` | コンソール/ネットワーク/エラー/ダイアログログをクリア |
| `expose_function` | 呼び出しを記録する関数をページに公開 |
| `add_init_script` | ページロード前に実行するスクリプトを追加 |
| `get_metrics` | ページのパフォーマンスメトリクスを取得 |
| `get_accessibility_tree` | ページまたは要素のアクセシビリティツリーを取得 |

### ストレージ/Cookieツール（4ツール）
| ツール | 説明 |
|------|------|
| `get_cookies` | ブラウザコンテキストからCookieを取得 |
| `set_cookies` | ブラウザコンテキストにCookieを設定 |
| `get_storage` | localStorage/sessionStorageの値を取得 |
| `set_storage` | localStorage/sessionStorageの値を設定 |

### ログツール（3ツール）
| ツール | 説明 |
|------|------|
| `get_console_logs` | コンソールログを取得（log/info/warn/error/debug） |
| `get_network_logs` | フィルタリング付きでネットワークリクエストログを取得 |
| `run_script` | ブラウザコンテキストでJavaScriptを実行 |

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

### デバッグ

```
ユーザー: ページのJavaScriptエラーをチェックして

Claude: JavaScriptエラーとコンソールログを確認します。

[get_page_errors sessionId="abc123"]
[get_console_logs sessionId="abc123" types=["error"]]
```

## 比較

| 機能 | Chrome DevTools MCP | Playwright MCP | Browserbase | **本プロジェクト** |
|------|---------------------|----------------|-------------|-------------------|
| 並列セッション | なし | なし | あり（クラウド） | **あり（ローカル）** |
| ツール数 | 約20 | 約30 | 約10 | **63ツール** |
| コンソールログ | あり | あり | なし | **あり** |
| ネットワークログ | あり | なし | なし | **あり** |
| JSエラー検出 | なし | なし | なし | **あり** |
| ダイアログ処理 | あり | なし | なし | **あり** |
| パフォーマンスメトリクス | あり | なし | なし | **あり** |
| 出力形式 | a11yツリー | a11yツリー | スクリーンショット | **ARIAスナップショット** |
| JavaScript実行 | あり | あり | なし | **あり** |
| Cookie管理 | あり | なし | なし | **あり** |
| ストレージアクセス | なし | なし | なし | **あり** |
| ファイルアップロード | なし | あり | なし | **あり** |
| PDF生成 | なし | なし | なし | **あり** |
| フレームサポート | あり | なし | なし | **あり** |
| 料金 | 無料 | 無料 | 有料 | **無料** |

## 環境変数

| 変数 | デフォルト値 | 説明 |
|------|-------------|------|
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

## ライセンス

MIT
