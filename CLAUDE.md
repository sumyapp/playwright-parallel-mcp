# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

An MCP (Model Context Protocol) server that enables multiple AI agents to simultaneously control independent browser instances. This solves the problem of existing browser automation MCP servers sharing browsers between sessions by providing isolated browser instances for each session.

## Development Commands

```bash
pnpm install          # Install dependencies
pnpm build            # Build with tsup (outputs to dist/)
pnpm dev              # Build in watch mode
pnpm start            # Start the built server
pnpm test             # Run tests with vitest
pnpm typecheck        # TypeScript type checking
```

## Architecture

```
src/
├── index.ts           # MCP server entry point, all tool definitions
└── session-manager.ts # Browser session management (singleton)
```

### Core Design

- **SessionManager (Singleton)**: Manages sessions via `Map<string, Session>`. Each session has an independent Browser, BrowserContext, and Page
- **Session**: Holds browser instance, console logs (max 1000 entries), and metadata
- **MCP Tools**: Defined using `server.tool()` from `@modelcontextprotocol/sdk` with Zod schema validation

### Adding New Tools

Add to `src/index.ts`:

```typescript
server.tool(
  "tool_name",
  "Tool description",
  {
    sessionId: z.string(),
    param: z.string().optional()
  },
  async ({ sessionId, param }) => {
    const session = sessionManager.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    // Implementation
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);
```

## Contribution Guidelines

### Language

- **Code**: All code, comments, and documentation must be in English
- **Commits**: Write commit messages in English
- **Issues/PRs**: Use English for all GitHub communication

### Commit Message Format

Use concise, descriptive commit messages:
- `feat: add screenshot tool` - New feature
- `fix: handle null session gracefully` - Bug fix
- `docs: update README examples` - Documentation
- `refactor: extract validation logic` - Code improvement
- `test: add navigation edge cases` - Test additions

### Code Style

- Follow existing patterns in the codebase
- Use TypeScript strict mode
- Validate all tool inputs with Zod schemas
- Handle errors gracefully with descriptive messages

## Tech Stack

- **TypeScript** (ES2022, ESM)
- **tsup** - Bundler with shebang injection
- **Playwright** - Browser automation (Chromium/Firefox/WebKit)
- **MCP SDK** - Model Context Protocol server (stdio transport)
- **Zod** - Runtime schema validation
- **Vitest** - Testing framework
