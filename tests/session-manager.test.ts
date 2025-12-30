import { describe, it, expect, afterEach } from 'vitest';
import { sessionManager } from '../src/session-manager.js';

/**
 * Session Manager Tests
 *
 * Comprehensive tests for session-manager.ts to achieve 100% coverage.
 * These tests cover all functionality including edge cases.
 */
describe('SessionManager', () => {
  afterEach(async () => {
    // Clean up all sessions after each test
    const sessions = sessionManager.listSessions();
    for (const session of sessions) {
      try {
        await sessionManager.closeSession(session.id);
      } catch {
        // Ignore errors during cleanup
      }
    }
    // Restart cleanup interval for other tests
    sessionManager.startCleanupInterval();
  });

  describe('createSession', () => {
    it('should create a new browser session', async () => {
      const session = await sessionManager.createSession({
        browser: 'chromium',
        headless: true
      });

      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(typeof session.id).toBe('string');
      expect(session.page).toBeDefined();
      expect(session.createdAt).toBeInstanceOf(Date);
    });

    it('should create chromium session by default', async () => {
      const session = await sessionManager.createSession({ headless: true });
      expect(session.browserType).toBe('chromium');
    });

    // Note: Firefox/WebKit tests are skipped if browsers are not installed
    // Run `npx playwright install` to install all browsers
    it.skip('should create firefox session when specified', async () => {
      const session = await sessionManager.createSession({ browser: 'firefox', headless: true });
      expect(session.browserType).toBe('firefox');
      expect(session.browser.isConnected()).toBe(true);
    });

    it.skip('should create webkit session when specified', async () => {
      const session = await sessionManager.createSession({ browser: 'webkit', headless: true });
      expect(session.browserType).toBe('webkit');
      expect(session.browser.isConnected()).toBe(true);
    });

    it('should use default viewport when not specified', async () => {
      const session = await sessionManager.createSession({ headless: true });
      const viewport = session.page.viewportSize();

      expect(viewport?.width).toBe(1280);
      expect(viewport?.height).toBe(720);
    });

    it('should use custom viewport when specified', async () => {
      const session = await sessionManager.createSession({
        headless: true,
        viewport: { width: 800, height: 600 }
      });
      const viewport = session.page.viewportSize();

      expect(viewport?.width).toBe(800);
      expect(viewport?.height).toBe(600);
    });

    it('should initialize console logs array', async () => {
      const session = await sessionManager.createSession({
        browser: 'chromium',
        headless: true
      });

      expect(session.consoleLogs).toBeDefined();
      expect(Array.isArray(session.consoleLogs)).toBe(true);
      expect(session.consoleLogs.length).toBe(0);
    });

    it('should initialize network logs map', async () => {
      const session = await sessionManager.createSession({
        browser: 'chromium',
        headless: true
      });

      expect(session.networkLogs).toBeDefined();
      expect(session.networkLogs instanceof Map).toBe(true);
      expect(session.networkLogs.size).toBe(0);
    });

    it('should have default dialog settings', async () => {
      const session = await sessionManager.createSession({ headless: true });

      expect(session.dialogAutoRespond).toBe(true);
      expect(session.dialogAutoResponse).toEqual({ accept: true });
    });

    it('should have createdAt and lastUsedAt timestamps', async () => {
      const before = new Date();
      const session = await sessionManager.createSession({ headless: true });
      const after = new Date();

      expect(session.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(session.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(session.lastUsedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe('getSession', () => {
    it('should return session by ID', async () => {
      const created = await sessionManager.createSession({
        browser: 'chromium',
        headless: true
      });

      const retrieved = sessionManager.getSession(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should return undefined for non-existent session', () => {
      const session = sessionManager.getSession('non-existent-id');
      expect(session).toBeUndefined();
    });
  });

  describe('listSessions', () => {
    it('should return empty array when no sessions exist', () => {
      const sessions = sessionManager.listSessions();
      expect(sessions).toEqual([]);
    });

    it('should return all active sessions', async () => {
      await sessionManager.createSession({ browser: 'chromium', headless: true });
      await sessionManager.createSession({ browser: 'chromium', headless: true });

      const sessions = sessionManager.listSessions();

      expect(sessions.length).toBe(2);
    });
  });

  describe('closeSession', () => {
    it('should close and remove session', async () => {
      const session = await sessionManager.createSession({
        browser: 'chromium',
        headless: true
      });

      await sessionManager.closeSession(session.id);

      const retrieved = sessionManager.getSession(session.id);
      expect(retrieved).toBeUndefined();
    });

    it('should throw error for non-existent session', async () => {
      await expect(
        sessionManager.closeSession('non-existent-id')
      ).rejects.toThrow('Session not found');
    });
  });

  describe('closeAllSessions', () => {
    it('should close all sessions', async () => {
      await sessionManager.createSession({ headless: true });
      await sessionManager.createSession({ headless: true });
      await sessionManager.createSession({ headless: true });

      expect(sessionManager.listSessions().length).toBe(3);

      await sessionManager.closeAllSessions();

      expect(sessionManager.listSessions().length).toBe(0);
    });
  });

  describe('updateLastUsed', () => {
    it('should update lastUsedAt timestamp', async () => {
      const session = await sessionManager.createSession({ headless: true });
      const originalLastUsed = session.lastUsedAt.getTime();

      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 50));

      sessionManager.updateLastUsed(session.id);

      const updatedSession = sessionManager.getSession(session.id);
      expect(updatedSession!.lastUsedAt.getTime()).toBeGreaterThan(originalLastUsed);
    });

    it('should not throw for non-existent session', () => {
      // Should not throw, just do nothing
      expect(() => sessionManager.updateLastUsed('non-existent-id')).not.toThrow();
    });
  });

  describe('parallel sessions', () => {
    it('should support multiple concurrent sessions', async () => {
      const sessions = await Promise.all([
        sessionManager.createSession({ browser: 'chromium', headless: true }),
        sessionManager.createSession({ browser: 'chromium', headless: true }),
        sessionManager.createSession({ browser: 'chromium', headless: true })
      ]);

      expect(sessions.length).toBe(3);

      // Each session should have a unique ID
      const ids = sessions.map(s => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);

      // Each session should have its own page instance
      const pages = sessions.map(s => s.page);
      expect(new Set(pages).size).toBe(3);
    });
  });

  describe('Console Log Capture', () => {
    it('should capture console.log', async () => {
      const session = await sessionManager.createSession({ headless: true });
      await session.page.goto('data:text/html,<h1>Test</h1>');

      await session.page.evaluate(() => console.log('Log message'));
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(session.consoleLogs.some(l => l.type === 'log' && l.text.includes('Log message'))).toBe(true);
    });

    it('should capture console.info', async () => {
      const session = await sessionManager.createSession({ headless: true });
      await session.page.goto('data:text/html,<h1>Test</h1>');

      await session.page.evaluate(() => console.info('Info message'));
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(session.consoleLogs.some(l => l.type === 'info' && l.text.includes('Info message'))).toBe(true);
    });

    it('should capture console.warn', async () => {
      const session = await sessionManager.createSession({ headless: true });
      await session.page.goto('data:text/html,<h1>Test</h1>');

      await session.page.evaluate(() => console.warn('Warning message'));
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(session.consoleLogs.some(l => l.type === 'warn' && l.text.includes('Warning message'))).toBe(true);
    });

    it('should capture console.error', async () => {
      const session = await sessionManager.createSession({ headless: true });
      await session.page.goto('data:text/html,<h1>Test</h1>');

      await session.page.evaluate(() => console.error('Error message'));
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(session.consoleLogs.some(l => l.type === 'error' && l.text.includes('Error message'))).toBe(true);
    });

    it('should capture console.debug', async () => {
      const session = await sessionManager.createSession({ headless: true });
      await session.page.goto('data:text/html,<h1>Test</h1>');

      await session.page.evaluate(() => console.debug('Debug message'));
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(session.consoleLogs.some(l => l.type === 'debug' && l.text.includes('Debug message'))).toBe(true);
    });

    it('should capture console.trace', async () => {
      const session = await sessionManager.createSession({ headless: true });
      await session.page.goto('data:text/html,<h1>Test</h1>');

      await session.page.evaluate(() => console.trace('Trace message'));
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(session.consoleLogs.some(l => l.type === 'trace' && l.text.includes('Trace message'))).toBe(true);
    });

    it('should include location information in console logs', async () => {
      const session = await sessionManager.createSession({ headless: true });

      // Use route to have a proper URL for location
      await session.page.route('http://localhost:8888/**', route => {
        route.fulfill({
          contentType: 'text/html',
          body: '<script>console.log("Test with location");</script>'
        });
      });
      await session.page.goto('http://localhost:8888/test.html');
      await new Promise(resolve => setTimeout(resolve, 100));

      const logWithLocation = session.consoleLogs.find(l => l.text.includes('Test with location'));
      expect(logWithLocation?.location).toBeDefined();
    });

    it('should include timestamp in console logs', async () => {
      const session = await sessionManager.createSession({ headless: true });
      await session.page.goto('data:text/html,<h1>Test</h1>');

      await session.page.evaluate(() => console.log('Timestamp test'));
      await new Promise(resolve => setTimeout(resolve, 100));

      const log = session.consoleLogs.find(l => l.text.includes('Timestamp test'));
      expect(log?.timestamp).toBeDefined();
      expect(new Date(log!.timestamp).getTime()).toBeGreaterThan(0);
    });
  });

  describe('Page Error Capture', () => {
    it('should capture JavaScript errors', async () => {
      const session = await sessionManager.createSession({ headless: true });

      await session.page.route('http://localhost:8888/**', route => {
        route.fulfill({
          contentType: 'text/html',
          body: '<script>throw new Error("Test JS Error");</script>'
        });
      });
      await session.page.goto('http://localhost:8888/error.html');
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(session.pageErrors.some(e => e.message.includes('Test JS Error'))).toBe(true);
      expect(session.pageErrors[0].name).toBeDefined();
      expect(session.pageErrors[0].timestamp).toBeDefined();
    });

    it('should capture error stack trace', async () => {
      const session = await sessionManager.createSession({ headless: true });

      await session.page.route('http://localhost:8888/**', route => {
        route.fulfill({
          contentType: 'text/html',
          body: '<script>function foo() { throw new Error("Stack test"); } foo();</script>'
        });
      });
      await session.page.goto('http://localhost:8888/stack.html');
      await new Promise(resolve => setTimeout(resolve, 100));

      const error = session.pageErrors.find(e => e.message.includes('Stack test'));
      expect(error?.stack).toBeDefined();
    });
  });

  describe('Dialog Handling', () => {
    it('should auto-accept dialogs by default', async () => {
      const session = await sessionManager.createSession({ headless: true });
      await session.page.goto('data:text/html,<button onclick="alert(\'Hello\')">Click</button>');

      await session.page.click('button');
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(session.pendingDialogs.some(d => d.message === 'Hello' && d.handled === true)).toBe(true);
    });

    it('should auto-dismiss dialogs when configured', async () => {
      const session = await sessionManager.createSession({ headless: true });
      session.dialogAutoResponse = { accept: false };

      await session.page.goto('data:text/html,<button onclick="confirm(\'Sure?\')">Click</button>');

      await session.page.click('button');
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(session.pendingDialogs.some(d => d.message === 'Sure?' && d.handled === true)).toBe(true);
    });

    it('should pass promptText to prompts', async () => {
      const session = await sessionManager.createSession({ headless: true });
      session.dialogAutoResponse = { accept: true, promptText: 'Test Input' };

      await session.page.goto('data:text/html,<div id="result"></div><button onclick="document.getElementById(\'result\').textContent = prompt(\'Name?\', \'default\')">Click</button>');

      await session.page.click('button');
      await new Promise(resolve => setTimeout(resolve, 100));

      const result = await session.page.textContent('#result');
      expect(result).toBe('Test Input');
    });

    it('should capture confirm dialogs', async () => {
      const session = await sessionManager.createSession({ headless: true });
      await session.page.goto('data:text/html,<button onclick="confirm(\'Confirm this?\')">Click</button>');

      await session.page.click('button');
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(session.pendingDialogs.some(d => d.type === 'confirm' && d.message === 'Confirm this?')).toBe(true);
    });

    it('should capture prompt dialogs with default value', async () => {
      const session = await sessionManager.createSession({ headless: true });
      await session.page.goto('data:text/html,<button onclick="prompt(\'Enter value\', \'default123\')">Click</button>');

      await session.page.click('button');
      await new Promise(resolve => setTimeout(resolve, 100));

      const promptDialog = session.pendingDialogs.find(d => d.type === 'prompt');
      expect(promptDialog?.defaultValue).toBe('default123');
    });

    it('should have dialog ID and timestamp', async () => {
      const session = await sessionManager.createSession({ headless: true });
      await session.page.goto('data:text/html,<button onclick="alert(\'Test\')">Click</button>');

      await session.page.click('button');
      await new Promise(resolve => setTimeout(resolve, 100));

      const dialog = session.pendingDialogs[0];
      expect(dialog.id).toBeDefined();
      expect(dialog.timestamp).toBeDefined();
    });
  });

  describe('Network Request Handling', () => {
    it('should capture request details', async () => {
      const session = await sessionManager.createSession({ headless: true });

      await session.page.route('http://localhost:8888/**', route => {
        route.fulfill({
          contentType: 'text/html',
          body: '<h1>Test</h1>'
        });
      });
      await session.page.goto('http://localhost:8888/test.html');
      await new Promise(resolve => setTimeout(resolve, 100));

      const logs = Array.from(session.networkLogs.values());
      const mainRequest = logs.find(l => l.url.includes('test.html'));

      expect(mainRequest?.method).toBe('GET');
      expect(mainRequest?.resourceType).toBe('document');
      expect(mainRequest?.requestHeaders).toBeDefined();
      expect(mainRequest?.timing.startTime).toBeDefined();
    });

    it('should capture response details', async () => {
      const session = await sessionManager.createSession({ headless: true });

      await session.page.route('http://localhost:8888/**', route => {
        route.fulfill({
          status: 200,
          statusText: 'OK',
          contentType: 'text/html',
          headers: { 'X-Custom-Header': 'test-value' },
          body: '<h1>Test</h1>'
        });
      });
      await session.page.goto('http://localhost:8888/test.html');
      await new Promise(resolve => setTimeout(resolve, 100));

      const logs = Array.from(session.networkLogs.values());
      const mainRequest = logs.find(l => l.url.includes('test.html'));

      expect(mainRequest?.status).toBe(200);
      expect(mainRequest?.statusText).toBe('OK');
      expect(mainRequest?.responseHeaders).toBeDefined();
      expect(mainRequest?.timing.endTime).toBeDefined();
      expect(mainRequest?.timing.duration).toBeGreaterThanOrEqual(0);
    });

    it('should capture failed requests', async () => {
      const session = await sessionManager.createSession({ headless: true });

      await session.page.route('http://localhost:8888/**', route => {
        route.abort('failed');
      });

      try {
        await session.page.goto('http://localhost:8888/fail.html', { timeout: 5000 });
      } catch {
        // Expected to fail
      }
      await new Promise(resolve => setTimeout(resolve, 100));

      const logs = Array.from(session.networkLogs.values());
      const failedRequest = logs.find(l => l.failed === true);

      expect(failedRequest).toBeDefined();
      expect(failedRequest?.failureText).toBeDefined();
      expect(failedRequest?.timing.endTime).toBeDefined();
    });
  });

  describe('Cleanup Interval', () => {
    it('should start and stop cleanup interval', () => {
      sessionManager.stopCleanupInterval();
      // Should not throw
      expect(true).toBe(true);

      sessionManager.startCleanupInterval();
      // Should not throw
      expect(true).toBe(true);
    });

    it('should restart cleanup interval when called multiple times', () => {
      sessionManager.startCleanupInterval();
      sessionManager.startCleanupInterval();
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('Inactive Session Cleanup', () => {
    it('should cleanup inactive sessions based on timeout', async () => {
      const session = await sessionManager.createSession({ headless: true });

      // Set lastUsedAt to 2 hours ago (beyond default 1 hour timeout)
      session.lastUsedAt = new Date(Date.now() - 2 * 60 * 60 * 1000);

      const closedCount = await sessionManager.cleanupInactiveSessions();

      expect(closedCount).toBe(1);
      expect(sessionManager.getSession(session.id)).toBeUndefined();
    });

    it('should not cleanup active sessions', async () => {
      const session = await sessionManager.createSession({ headless: true });
      // lastUsedAt is set to now on creation

      const closedCount = await sessionManager.cleanupInactiveSessions();

      expect(closedCount).toBe(0);
      expect(sessionManager.getSession(session.id)).toBeDefined();
    });
  });

  describe('Browser Disconnection', () => {
    it('should clean up session when browser disconnects', async () => {
      const session = await sessionManager.createSession({ headless: true });
      const sessionId = session.id;

      // Force close the browser directly
      await session.browser.close();

      // Wait for disconnect handler
      await new Promise(resolve => setTimeout(resolve, 100));

      // Session should be removed
      expect(sessionManager.getSession(sessionId)).toBeUndefined();
    });
  });
});
