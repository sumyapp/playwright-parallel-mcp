import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { McpClient } from '../src/mcp-client.js';
import { BackendConfig } from '../src/types.js';

/**
 * McpClient Tests
 *
 * Tests for the MCP client that manages child process communication.
 * Uses mocking to test without spawning actual processes where possible.
 */
describe('McpClient', () => {
  const testConfig: BackendConfig = {
    command: 'npx',
    args: ['@playwright/mcp@latest']
  };

  describe('constructor', () => {
    it('should create instance with config', () => {
      const client = new McpClient(testConfig);
      expect(client).toBeDefined();
      expect(client).toBeInstanceOf(McpClient);
    });

    it('should inherit from EventEmitter', () => {
      const client = new McpClient(testConfig);
      expect(typeof client.on).toBe('function');
      expect(typeof client.emit).toBe('function');
    });
  });

  describe('isRunning', () => {
    it('should return false before start', () => {
      const client = new McpClient(testConfig);
      expect(client.isRunning()).toBe(false);
    });

    it('should return true after start', async () => {
      const client = new McpClient(testConfig);
      await client.start();
      expect(client.isRunning()).toBe(true);
      await client.stop();
    });

    it('should return false after stop', async () => {
      const client = new McpClient(testConfig);
      await client.start();
      await client.stop();
      expect(client.isRunning()).toBe(false);
    });
  });

  describe('getTools', () => {
    it('should return empty array before start', () => {
      const client = new McpClient(testConfig);
      expect(client.getTools()).toEqual([]);
    });

    it('should return tools after start', async () => {
      const client = new McpClient(testConfig);
      await client.start();
      const tools = client.getTools();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      await client.stop();
    });

    it('should have tools with name and inputSchema', async () => {
      const client = new McpClient(testConfig);
      await client.start();
      const tools = client.getTools();
      const tool = tools[0];
      expect(tool.name).toBeDefined();
      expect(typeof tool.name).toBe('string');
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
      await client.stop();
    });
  });

  describe('stop', () => {
    it('should be safe to call multiple times', async () => {
      const client = new McpClient(testConfig);
      await client.start();
      await client.stop();
      await client.stop(); // Second call should not throw
      expect(client.isRunning()).toBe(false);
    });

    it('should be safe to call without start', async () => {
      const client = new McpClient(testConfig);
      await client.stop(); // Should not throw
      expect(client.isRunning()).toBe(false);
    });

    it('should clear pending requests', async () => {
      const client = new McpClient(testConfig);
      await client.start();
      // Start a long-running request but don't wait for it
      const requestPromise = client.sendRequest('tools/call', {
        name: 'browser_navigate',
        arguments: { url: 'https://example.com' }
      });
      // Stop immediately - request should be rejected
      await client.stop();
      await expect(requestPromise).rejects.toThrow('Process stopped');
    });
  });

  describe('sendRequest', () => {
    it('should throw error when process not started', async () => {
      const client = new McpClient(testConfig);
      await expect(
        client.sendRequest('test', {})
      ).rejects.toThrow('Process not started');
    });

    it('should return result for valid request', async () => {
      const client = new McpClient(testConfig);
      await client.start();
      // tools/list is a standard MCP method
      const result = await client.sendRequest('tools/list', {});
      expect(result).toBeDefined();
      expect((result as { tools: unknown[] }).tools).toBeDefined();
      await client.stop();
    });
  });

  describe('sendNotification', () => {
    it('should not throw when process not started', () => {
      const client = new McpClient(testConfig);
      expect(() => {
        client.sendNotification('test', {});
      }).not.toThrow();
    });

    it('should send notification without waiting for response', async () => {
      const client = new McpClient(testConfig);
      await client.start();
      // Should complete immediately without error
      client.sendNotification('notifications/test', { data: 'test' });
      await client.stop();
    });
  });

  describe('callTool', () => {
    it('should throw error when process not started', async () => {
      const client = new McpClient(testConfig);
      await expect(
        client.callTool('browser_snapshot', {})
      ).rejects.toThrow('Process not started');
    });

    it('should call tool and return result', async () => {
      const client = new McpClient(testConfig);
      await client.start();
      // browser_snapshot works without a page (returns error content)
      const result = await client.callTool('browser_snapshot', {});
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      await client.stop();
    });
  });

  describe('exit event', () => {
    it('should emit exit event when process exits', async () => {
      const client = new McpClient(testConfig);
      await client.start();

      const exitPromise = new Promise<number | null>((resolve) => {
        client.on('exit', resolve);
      });

      await client.stop();
      const exitCode = await exitPromise;
      expect(exitCode).toBeDefined();
    });

    it('should reject pending requests when process exits', async () => {
      const client = new McpClient(testConfig);
      await client.start();

      // Start a long-running request (will be rejected when process stops)
      const requestPromise = client.sendRequest('tools/call', {
        name: 'browser_navigate',
        arguments: { url: 'https://example.com' }
      });

      // Stop the process - pending requests should be rejected
      await client.stop();

      // Request should be rejected with "Process stopped"
      await expect(requestPromise).rejects.toThrow('Process stopped');
    });
  });

  describe('environment variables', () => {
    it('should pass custom env to child process', async () => {
      const configWithEnv: BackendConfig = {
        command: 'npx',
        args: ['@playwright/mcp@latest'],
        env: {
          CUSTOM_VAR: 'test_value'
        }
      };
      const client = new McpClient(configWithEnv);
      await client.start();
      expect(client.isRunning()).toBe(true);
      await client.stop();
    });
  });

  describe('concurrent requests', () => {
    it('should handle multiple concurrent requests', async () => {
      const client = new McpClient(testConfig);
      await client.start();

      // Send multiple requests concurrently
      const promises = [
        client.sendRequest('tools/list', {}),
        client.sendRequest('tools/list', {}),
        client.sendRequest('tools/list', {})
      ];

      const results = await Promise.all(promises);
      expect(results.length).toBe(3);
      results.forEach(result => {
        expect((result as { tools: unknown[] }).tools).toBeDefined();
      });

      await client.stop();
    });
  });
});
