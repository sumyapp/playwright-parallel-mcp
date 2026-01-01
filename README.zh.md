# playwright-parallel-mcp

[![CI](https://github.com/sumyapp/playwright-parallel-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/sumyapp/playwright-parallel-mcp/actions/workflows/ci.yml)
[![Coverage Status](https://coveralls.io/repos/github/sumyapp/playwright-parallel-mcp/badge.svg?branch=main)](https://coveralls.io/github/sumyapp/playwright-parallel-mcp?branch=main)
[![npm version](https://badge.fury.io/js/playwright-parallel-mcp.svg)](https://www.npmjs.com/package/playwright-parallel-mcp)

[English](README.md) | [日本語](README.ja.md) | **[中文](README.zh.md)**

一个MCP（Model Context Protocol）服务器，使AI代理能够并行控制**多个独立的浏览器实例**。

## 安全警告

> **此MCP服务器提供强大的浏览器自动化功能，如果暴露给不受信任的用户可能会被滥用。**

- **`run_script`**：在浏览器上下文中执行任意JavaScript
- **`upload_file`**：访问文件系统进行文件上传
- **`generate_pdf`** / **`add_init_script`**：（仅Full模式）额外的文件系统访问和脚本注入功能

**请勿将此服务器暴露给不受信任的用户或AI代理。** 仅在您信任所有可连接客户端的受控环境中使用。

## 问题

现有的浏览器自动化MCP服务器（Chrome DevTools MCP、Playwright MCP）在所有会话之间共享单个浏览器实例，当多个AI代理尝试同时使用时会导致冲突。

## 解决方案

playwright-parallel-mcp为**每个会话创建隔离的浏览器实例**，实现真正的并行浏览器自动化。

## 会话隔离保证

**每个会话100%隔离。** 这在架构层面得到保证，并通过全面的测试进行验证。

### 架构

```
会话A                        会话B                        会话C
    │                            │                            │
    ▼                            ▼                            ▼
┌─────────┐                ┌─────────┐                ┌─────────┐
│ 浏览器  │                │ 浏览器  │                │ 浏览器  │
│  进程   │                │  进程   │                │  进程   │
│  (OS)   │                │  (OS)   │                │  (OS)   │
└────┬────┘                └────┬────┘                └────┬────┘
     │                          │                          │
     ▼                          ▼                          ▼
┌─────────┐                ┌─────────┐                ┌─────────┐
│  上下文  │                │  上下文  │                │  上下文  │
│(Cookie) │                │(Cookie) │                │(Cookie) │
└────┬────┘                └────┬────┘                └────┬────┘
     │                          │                          │
     ▼                          ▼                          ▼
┌─────────┐                ┌─────────┐                ┌─────────┐
│  页面   │                │  页面   │                │  页面   │
│ (DOM)   │                │ (DOM)   │                │ (DOM)   │
└─────────┘                └─────────┘                └─────────┘
```

### 隔离的资源

| 资源 | 隔离? | 方式 |
|------|-------|------|
| 浏览器进程 | ✅ 是 | 每个会话独立的OS进程 |
| Cookie | ✅ 是 | 独立的BrowserContext |
| localStorage | ✅ 是 | 独立的BrowserContext |
| sessionStorage | ✅ 是 | 独立的BrowserContext |
| DOM | ✅ 是 | 独立的Page实例 |
| 导航历史 | ✅ 是 | 独立的Page实例 |
| 控制台日志 | ✅ 是 | 按会话存储 |
| 网络日志 | ✅ 是 | 按会话存储 |

### 测试覆盖

会话隔离通过**17个专用测试**进行验证：

- 浏览器进程隔离
- 导航隔离
- DOM隔离
- Cookie隔离
- localStorage/sessionStorage隔离
- 控制台日志隔离
- 网络日志隔离
- 并发操作安全性
- 会话ID唯一性（UUID v4）

运行 `pnpm test` 验证隔离保证。

## 特性

- **并行会话** - 每个会话拥有自己的浏览器实例
- **多浏览器支持** - 支持Chromium、Firefox、WebKit
- **22个工具** - 基本的浏览器自动化功能（Full模式63个）
- **低上下文使用量** - 约14k令牌（与@playwright/mcp相当）
- **控制台日志** - 捕获控制台输出用于调试
- **对话框处理** - 处理alert、confirm、prompt对话框
- **无障碍快照** - ARIA快照格式（Playwright 1.49+）
- **免费且本地** - 无需云服务

## 安装

### 与Claude Code一起使用

添加到MCP设置：

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

### 使用npm

```bash
npm install -g playwright-parallel-mcp
playwright-parallel-mcp
```

## 可用工具（22个）

### 会话管理（3个）
| 工具 | 描述 |
|------|------|
| `create_session` | 创建新的隔离浏览器会话（chromium/firefox/webkit） |
| `close_session` | 关闭浏览器会话 |
| `list_sessions` | 列出所有活动会话 |

### 导航（4个）
| 工具 | 描述 |
|------|------|
| `navigate` | 导航到URL |
| `go_back` | 浏览器历史后退 |
| `reload` | 重新加载当前页面 |
| `get_url` | 获取当前URL和页面标题 |

### 页面检查（2个）
| 工具 | 描述 |
|------|------|
| `snapshot` | 获取无障碍树（ARIA快照格式） |
| `screenshot` | 截图（PNG/JPEG，全页或元素） |

### 用户交互（6个）
| 工具 | 描述 |
|------|------|
| `click` | 点击元素（左/右/中键） |
| `fill` | 向表单输入框填充文本 |
| `type` | 模拟真实的逐键输入 |
| `press_key` | 按键盘键（如Enter、Control+A） |
| `hover` | 悬停在元素上 |
| `select_option` | 从下拉菜单选择 |

### 其他工具（7个）
| 工具 | 描述 |
|------|------|
| `wait_for_timeout` | 等待指定时间 |
| `set_dialog_handler` | 配置自动对话框处理（接受/拒绝） |
| `upload_file` | 向文件输入元素上传文件 |
| `drag_and_drop` | 拖放元素到另一个元素 |
| `run_script` | 在浏览器上下文中执行JavaScript |
| `get_console_logs` | 获取控制台日志（log/info/warn/error/debug） |
| `set_viewport` | 更改视口大小 |

## 使用示例

### 基本导航

```
用户：打开example.com并截图

Claude：我将创建一个浏览器会话并导航到example.com。

[create_session] -> sessionId: "abc123"
[navigate sessionId="abc123" url="https://example.com"]
[screenshot sessionId="abc123"]
```

### 并行会话

```
用户：并排比较两个网站的主页

Claude：我将并行创建两个浏览器会话。

[create_session] -> sessionId: "session-a"
[create_session] -> sessionId: "session-b"
[navigate sessionId="session-a" url="https://example.com"]
[navigate sessionId="session-b" url="https://google.com"]
[snapshot sessionId="session-a"]
[snapshot sessionId="session-b"]
```

### 表单交互

```
用户：填写登录表单

Claude：我将填写表单字段并提交。

[fill sessionId="abc123" selector="input[name='email']" value="user@example.com"]
[fill sessionId="abc123" selector="input[name='password']" value="***"]
[click sessionId="abc123" selector="button[type='submit']"]
```

### 控制台日志

```
用户：检查页面的控制台输出

Claude：我将检查控制台日志和错误。

[get_console_logs sessionId="abc123" types=["error", "warn"]]
```

### 对话框处理

```
用户：处理确认对话框

Claude：我将设置自动对话框处理。

[set_dialog_handler sessionId="abc123" autoRespond=true accept=true]
[click sessionId="abc123" selector="#delete-button"]
```

## 工具参考

### create_session

创建新的隔离浏览器会话。

**参数：**
- `browser`（可选）："chromium" | "firefox" | "webkit"（默认："chromium"）
- `headless`（可选）：boolean（默认：true）
- `viewport`（可选）：{ width: number, height: number }

**返回：** `{ sessionId, browser, createdAt }`

### navigate

导航到URL。

**参数：**
- `sessionId`：string
- `url`：string（有效URL）
- `waitUntil`（可选）："load" | "domcontentloaded" | "networkidle"（默认："load"）

**返回：** `{ url, title, status }`

### snapshot

获取ARIA快照格式的无障碍树。

**参数：**
- `sessionId`：string

**返回：** YAML格式的无障碍树

### run_script

在浏览器上下文中执行JavaScript。

**参数：**
- `sessionId`：string
- `expression`：要评估的JavaScript表达式

**返回：** `{ success: boolean, result?: any, error?: string }`

## 比较

| 功能 | Chrome DevTools MCP | Playwright MCP | **本项目** |
|------|---------------------|----------------|-----------|
| 并行会话 | 无 | 无 | **有** |
| 会话隔离 | 无 | 无 | **有（API级别）** |
| 工具数量 | 约26 | 约22 | **22（Lite）/ 63（Full）** |
| 上下文令牌 | 约17k | 约14k | **约14k（Lite）/ 约40k（Full）** |
| 控制台日志 | 有 | 有 | **有** |
| 对话框处理 | 有 | 无 | **有** |
| JavaScript执行 | 有 | 有 | **有** |
| 文件上传 | 无 | 有 | **有** |
| 费用 | 免费 | 免费 | **免费** |

### 上下文令牌使用量（实测）

在Claude Code中作为MCP工具加载时的令牌消耗（`/context`命令）：

| MCP服务器 | 工具数 | 总令牌 | 平均/工具 |
|----------|--------|--------|----------|
| **playwright-parallel-mcp (Lite)** | 22 | 约14,000 | 640 |
| **playwright-parallel-mcp (Full)** | 63 | 40,343 | 640 |
| [@playwright/mcp](https://github.com/microsoft/playwright-mcp) | 22 | 14,534 | 661 |
| [chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp) | 26 | 17,668 | 680 |

> **Lite模式（默认）** 提供与@playwright/mcp相同的工具数量和相当的令牌使用量，同时添加了用于并行执行的会话隔离。

## 环境变量

| 变量 | 默认值 | 描述 |
|------|--------|------|
| `PLAYWRIGHT_PARALLEL_MODE` | `lite` | 模式：`lite`（22个工具）或 `full`（63个工具） |
| `MAX_SESSIONS` | 10 | 最大并发浏览器会话数 |
| `SESSION_TIMEOUT_MS` | 3600000 | 会话不活动超时（1小时） |

## 要求

- Node.js 20+
- Playwright浏览器（自动安装）

## 开发

```bash
git clone https://github.com/sumyapp/playwright-parallel-mcp
cd playwright-parallel-mcp
pnpm install
pnpm build
pnpm start
```

### 运行测试

```bash
pnpm test
```

### 项目结构

```
src/
  index.ts          # MCP服务器入口点，所有工具定义
  session-manager.ts # 浏览器会话生命周期管理
```

## Full模式

Full模式提供**无法用`run_script`替代**的功能，对特定用例至关重要。

### 何时使用Full模式

| 用例 | 所需工具 | 为什么run_script无法替代 |
|------|----------|------------------------|
| **API监控** | `get_network_logs` | 捕获所有HTTP请求/响应，包括头信息、时间和状态码 |
| **性能分析** | `get_metrics` | 访问Navigation Timing API、内存使用、绘制指标 |
| **PDF报告生成** | `generate_pdf` | 带页面格式选项的浏览器级PDF渲染 |
| **iframe自动化** | `frame_click`, `frame_fill` | 访问JavaScript无法触及的跨域iframe |
| **JS错误检测** | `get_page_errors` | 在丢失之前捕获未捕获的异常 |
| **无障碍审计** | `get_accessibility_tree` | 用于合规测试的完整ARIA树结构 |

### 示例：使用网络日志进行API测试

```
用户：测试登录API并验证响应

Claude：我将监控登录期间的网络请求。

[get_network_logs sessionId="abc" resourceTypes=["fetch","xhr"]]
→ 捕获：POST /api/login (200, 145ms, 响应体可用)
```

这是`run_script`无法做到的，因为：
- Fetch/XHR拦截需要在请求之前设置
- 响应体在完成后无法访问
- 时间信息会丢失

### 配置

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

### 额外工具（41个，约40k令牌）

<details>
<summary>点击展开完整工具列表</summary>

- **导航**：go_forward
- **页面检查**：get_content, get_html
- **用户交互**：check, uncheck
- **等待工具**：wait_for_selector, wait_for_load_state, wait_for_url, wait_for_function
- **对话框**：get_dialogs
- **元素状态**：get_element_state, get_attribute, get_bounding_box, count_elements, get_all_texts
- **滚动**：scroll, scroll_into_view
- **鼠标**：mouse_move, mouse_click, mouse_down, mouse_up, mouse_wheel
- **模拟**：set_geolocation, set_offline, set_extra_http_headers
- **存储/Cookie**：get_cookies, set_cookies, get_storage, set_storage
- **网络**：get_network_logs
- **PDF/Frame**：generate_pdf, list_frames, frame_click, frame_fill, frame_get_content
- **调试**：get_page_errors, clear_logs, expose_function, add_init_script, get_metrics, get_accessibility_tree

</details>

## 许可证

MIT
