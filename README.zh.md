# playwright-parallel-mcp

[English](README.md) | [日本語](README.ja.md) | **[中文](README.zh.md)**

一个MCP（Model Context Protocol）服务器，使AI代理能够并行控制**多个独立的浏览器实例**。

## 安全警告

> **此MCP服务器提供强大的浏览器自动化功能，如果暴露给不受信任的用户可能会被滥用。**

- **`run_script`**：在浏览器上下文中执行任意JavaScript
- **`generate_pdf`** / **`upload_file`**：访问文件系统进行读写操作
- **`add_init_script`**：注入在每次页面加载时运行的脚本

**请勿将此服务器暴露给不受信任的用户或AI代理。** 仅在您信任所有可连接客户端的受控环境中使用。

## 问题

现有的浏览器自动化MCP服务器（Chrome DevTools MCP、Playwright MCP）在所有会话之间共享单个浏览器实例，当多个AI代理尝试同时使用时会导致冲突。

## 解决方案

playwright-parallel-mcp为**每个会话创建隔离的浏览器实例**，实现真正的并行浏览器自动化。

## 特性

- **并行会话** - 每个会话拥有自己的浏览器实例
- **多浏览器支持** - 支持Chromium、Firefox、WebKit
- **63个工具** - 全面的浏览器自动化功能
- **控制台和网络日志** - 完整的调试支持
- **JS错误检测** - 捕获JavaScript错误
- **对话框处理** - 处理alert、confirm、prompt对话框
- **性能指标** - 获取时间和内存指标
- **无障碍快照** - ARIA快照格式（Playwright 1.49+）
- **免费且本地** - 无需云服务

## 安装

### 与Claude Code一起使用

添加到您的MCP设置：

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

## 可用工具（共63个）

### 会话管理（3个工具）
| 工具 | 描述 |
|------|------|
| `create_session` | 创建新的隔离浏览器会话（chromium/firefox/webkit） |
| `close_session` | 关闭浏览器会话 |
| `list_sessions` | 列出所有活动会话 |

### 导航（5个工具）
| 工具 | 描述 |
|------|------|
| `navigate` | 导航到URL |
| `go_back` | 浏览器历史后退 |
| `go_forward` | 浏览器历史前进 |
| `reload` | 重新加载当前页面 |
| `get_url` | 获取当前URL和页面标题 |

### 页面检查（4个工具）
| 工具 | 描述 |
|------|------|
| `snapshot` | 获取无障碍树（ARIA快照格式） |
| `screenshot` | 截图（PNG/JPEG，全页或元素） |
| `get_content` | 获取页面或元素的文本内容 |
| `get_html` | 获取页面或元素的HTML |

### 用户交互（8个工具）
| 工具 | 描述 |
|------|------|
| `click` | 点击元素（左/右/中键） |
| `fill` | 在表单输入中填充文本 |
| `select_option` | 从下拉菜单选择 |
| `hover` | 悬停在元素上 |
| `press_key` | 按键盘键（例如：Enter、Control+A） |
| `type` | 以真实的逐键输入方式输入文本 |
| `check` | 选中复选框 |
| `uncheck` | 取消选中复选框 |

### 等待工具（5个工具）
| 工具 | 描述 |
|------|------|
| `wait_for_selector` | 等待元素出现/消失 |
| `wait_for_load_state` | 等待页面加载状态（load/domcontentloaded/networkidle） |
| `wait_for_url` | 等待URL匹配模式 |
| `wait_for_function` | 等待JavaScript条件为真 |
| `wait_for_timeout` | 等待指定时间 |

### 对话框工具（2个工具）
| 工具 | 描述 |
|------|------|
| `get_dialogs` | 从会话获取对话框历史 |
| `set_dialog_handler` | 配置自动对话框处理（接受/拒绝） |

### 元素状态工具（5个工具）
| 工具 | 描述 |
|------|------|
| `get_element_state` | 获取元素状态（可见、启用、选中、可编辑） |
| `get_attribute` | 获取元素的属性值 |
| `get_bounding_box` | 获取元素的边界框 |
| `count_elements` | 计算匹配选择器的元素数量 |
| `get_all_texts` | 获取所有匹配元素的文本内容 |

### 文件/拖放/滚动工具（4个工具）
| 工具 | 描述 |
|------|------|
| `upload_file` | 上传文件到文件输入元素 |
| `drag_and_drop` | 拖动元素并放置到另一个元素上 |
| `scroll` | 滚动页面或元素 |
| `scroll_into_view` | 将元素滚动到视图中 |

### 鼠标工具（5个工具）
| 工具 | 描述 |
|------|------|
| `mouse_move` | 将鼠标移动到特定坐标 |
| `mouse_click` | 在特定坐标点击 |
| `mouse_down` | 按下鼠标按钮 |
| `mouse_up` | 释放鼠标按钮 |
| `mouse_wheel` | 使用鼠标滚轮滚动 |

### 模拟工具（4个工具）
| 工具 | 描述 |
|------|------|
| `set_viewport` | 更改视口大小 |
| `set_geolocation` | 设置浏览器上下文的地理位置 |
| `set_offline` | 设置浏览器离线/在线模式 |
| `set_extra_http_headers` | 为所有请求设置额外的HTTP头 |

### PDF/框架工具（5个工具）
| 工具 | 描述 |
|------|------|
| `generate_pdf` | 生成当前页面的PDF（仅Chromium） |
| `list_frames` | 列出页面中的所有框架 |
| `frame_click` | 点击框架内的元素 |
| `frame_fill` | 在框架内的输入框中填充 |
| `frame_get_content` | 获取框架内元素的文本内容 |

### 调试工具（6个工具）
| 工具 | 描述 |
|------|------|
| `get_page_errors` | 获取页面的JavaScript错误 |
| `clear_logs` | 清除控制台/网络/错误/对话框日志 |
| `expose_function` | 向页面公开记录调用的函数 |
| `add_init_script` | 添加在页面加载前运行的脚本 |
| `get_metrics` | 获取页面性能指标 |
| `get_accessibility_tree` | 获取页面或元素的无障碍树 |

### 存储/Cookie工具（4个工具）
| 工具 | 描述 |
|------|------|
| `get_cookies` | 从浏览器上下文获取Cookie |
| `set_cookies` | 在浏览器上下文中设置Cookie |
| `get_storage` | 获取localStorage/sessionStorage的值 |
| `set_storage` | 设置localStorage/sessionStorage的值 |

### 日志工具（3个工具）
| 工具 | 描述 |
|------|------|
| `get_console_logs` | 获取控制台日志（log/info/warn/error/debug） |
| `get_network_logs` | 获取带过滤的网络请求日志 |
| `run_script` | 在浏览器上下文中执行JavaScript |

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

### 调试

```
用户：检查页面上的JavaScript错误

Claude：我将检查JavaScript错误和控制台日志。

[get_page_errors sessionId="abc123"]
[get_console_logs sessionId="abc123" types=["error"]]
```

## 比较

| 功能 | Chrome DevTools MCP | Playwright MCP | Browserbase | **本项目** |
|------|---------------------|----------------|-------------|-----------|
| 并行会话 | 否 | 否 | 是（云端） | **是（本地）** |
| 工具数量 | ~20 | ~30 | ~10 | **63个工具** |
| 控制台日志 | 是 | 是 | 否 | **是** |
| 网络日志 | 是 | 否 | 否 | **是** |
| JS错误检测 | 否 | 否 | 否 | **是** |
| 对话框处理 | 是 | 否 | 否 | **是** |
| 性能指标 | 是 | 否 | 否 | **是** |
| 输出格式 | a11y树 | a11y树 | 截图 | **ARIA快照** |
| JavaScript执行 | 是 | 是 | 否 | **是** |
| Cookie管理 | 是 | 否 | 否 | **是** |
| 存储访问 | 否 | 否 | 否 | **是** |
| 文件上传 | 否 | 是 | 否 | **是** |
| PDF生成 | 否 | 否 | 否 | **是** |
| 框架支持 | 是 | 否 | 否 | **是** |
| 费用 | 免费 | 免费 | 付费 | **免费** |

## 环境变量

| 变量 | 默认值 | 描述 |
|------|-------|------|
| `MAX_SESSIONS` | 10 | 最大并发浏览器会话数 |
| `SESSION_TIMEOUT_MS` | 3600000 | 会话非活动超时（1小时） |

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

## 许可证

MIT
