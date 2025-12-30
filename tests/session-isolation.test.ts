import { describe, it, expect, afterEach } from 'vitest';
import { sessionManager } from '../src/session-manager.js';

/**
 * Session Isolation Tests
 *
 * These tests verify that each browser session is completely isolated from others.
 * This is a critical guarantee of playwright-parallel-mcp.
 *
 * Architecture:
 * - Each session has its own Browser process (OS-level isolation)
 * - Each session has its own BrowserContext (cookie/storage isolation)
 * - Each session has its own Page (DOM/navigation isolation)
 */
describe('Session Isolation', () => {
  afterEach(async () => {
    const sessions = sessionManager.listSessions();
    for (const session of sessions) {
      await sessionManager.closeSession(session.id);
    }
  });

  describe('Browser Process Isolation', () => {
    it('should create separate browser instances for each session', async () => {
      const sessionA = await sessionManager.createSession({ headless: true });
      const sessionB = await sessionManager.createSession({ headless: true });

      // Each session should have a distinct browser instance
      expect(sessionA.browser).not.toBe(sessionB.browser);

      // Browser instances should be independently connected
      expect(sessionA.browser.isConnected()).toBe(true);
      expect(sessionB.browser.isConnected()).toBe(true);
    });

    it('should not affect other sessions when one browser closes', async () => {
      const sessionA = await sessionManager.createSession({ headless: true });
      const sessionB = await sessionManager.createSession({ headless: true });

      // Close sessionA's browser
      await sessionManager.closeSession(sessionA.id);

      // sessionB should still be functional
      expect(sessionB.browser.isConnected()).toBe(true);
      await sessionB.page.goto('data:text/html,<h1>Still Working</h1>');
      const content = await sessionB.page.textContent('h1');
      expect(content).toBe('Still Working');
    });
  });

  describe('Navigation Isolation', () => {
    it('should maintain independent URLs across sessions', async () => {
      const sessionA = await sessionManager.createSession({ headless: true });
      const sessionB = await sessionManager.createSession({ headless: true });

      // Navigate to different URLs
      await sessionA.page.goto('data:text/html,<title>Page A</title><h1>Session A</h1>');
      await sessionB.page.goto('data:text/html,<title>Page B</title><h1>Session B</h1>');

      // Verify URLs are independent
      expect(sessionA.page.url()).toContain('Page A');
      expect(sessionB.page.url()).toContain('Page B');

      // Verify content is independent
      const titleA = await sessionA.page.title();
      const titleB = await sessionB.page.title();
      expect(titleA).toBe('Page A');
      expect(titleB).toBe('Page B');
    });

    it('should not affect other sessions when navigating', async () => {
      const sessionA = await sessionManager.createSession({ headless: true });
      const sessionB = await sessionManager.createSession({ headless: true });

      await sessionA.page.goto('data:text/html,<h1>Initial A</h1>');
      await sessionB.page.goto('data:text/html,<h1>Initial B</h1>');

      // Navigate sessionA to a new page
      await sessionA.page.goto('data:text/html,<h1>Changed A</h1>');

      // sessionB should remain unchanged
      const contentB = await sessionB.page.textContent('h1');
      expect(contentB).toBe('Initial B');
    });

    it('should handle parallel navigation without interference', async () => {
      const sessionA = await sessionManager.createSession({ headless: true });
      const sessionB = await sessionManager.createSession({ headless: true });
      const sessionC = await sessionManager.createSession({ headless: true });

      // Navigate all sessions in parallel
      await Promise.all([
        sessionA.page.goto('data:text/html,<h1>A</h1>'),
        sessionB.page.goto('data:text/html,<h1>B</h1>'),
        sessionC.page.goto('data:text/html,<h1>C</h1>')
      ]);

      // Verify each session has correct content
      const [contentA, contentB, contentC] = await Promise.all([
        sessionA.page.textContent('h1'),
        sessionB.page.textContent('h1'),
        sessionC.page.textContent('h1')
      ]);

      expect(contentA).toBe('A');
      expect(contentB).toBe('B');
      expect(contentC).toBe('C');
    });
  });

  describe('DOM Isolation', () => {
    it('should not share DOM changes between sessions', async () => {
      const sessionA = await sessionManager.createSession({ headless: true });
      const sessionB = await sessionManager.createSession({ headless: true });

      // Both start with same content
      const html = 'data:text/html,<h1 id="title">Original</h1>';
      await sessionA.page.goto(html);
      await sessionB.page.goto(html);

      // Modify DOM in sessionA
      await sessionA.page.evaluate(() => {
        document.getElementById('title')!.textContent = 'Modified by A';
      });

      // sessionB should be unchanged
      const titleA = await sessionA.page.textContent('#title');
      const titleB = await sessionB.page.textContent('#title');

      expect(titleA).toBe('Modified by A');
      expect(titleB).toBe('Original');
    });

    it('should isolate document.title changes', async () => {
      const sessionA = await sessionManager.createSession({ headless: true });
      const sessionB = await sessionManager.createSession({ headless: true });

      await sessionA.page.goto('data:text/html,<title>Initial</title>');
      await sessionB.page.goto('data:text/html,<title>Initial</title>');

      // Change title in sessionA
      await sessionA.page.evaluate(() => {
        document.title = 'Changed Title';
      });

      const titleA = await sessionA.page.title();
      const titleB = await sessionB.page.title();

      expect(titleA).toBe('Changed Title');
      expect(titleB).toBe('Initial');
    });
  });

  describe('Cookie Isolation', () => {
    it('should not share cookies between sessions', async () => {
      const sessionA = await sessionManager.createSession({ headless: true });
      const sessionB = await sessionManager.createSession({ headless: true });

      await sessionA.page.goto('data:text/html,<h1>A</h1>');
      await sessionB.page.goto('data:text/html,<h1>B</h1>');

      // Set cookie in sessionA
      await sessionA.context.addCookies([{
        name: 'testCookie',
        value: 'sessionA',
        domain: 'localhost',
        path: '/'
      }]);

      // Get cookies from both sessions
      const cookiesA = await sessionA.context.cookies();
      const cookiesB = await sessionB.context.cookies();

      expect(cookiesA.find(c => c.name === 'testCookie')?.value).toBe('sessionA');
      expect(cookiesB.find(c => c.name === 'testCookie')).toBeUndefined();
    });
  });

  describe('Storage Isolation', () => {
    it('should not share localStorage between sessions', async () => {
      const sessionA = await sessionManager.createSession({ headless: true });
      const sessionB = await sessionManager.createSession({ headless: true });

      // Use route to serve HTML with proper origin (localStorage requires http/https)
      const html = '<html><body><h1>Test</h1></body></html>';
      await sessionA.page.route('http://localhost:9999/**', route => {
        route.fulfill({ contentType: 'text/html', body: html });
      });
      await sessionB.page.route('http://localhost:9999/**', route => {
        route.fulfill({ contentType: 'text/html', body: html });
      });

      await sessionA.page.goto('http://localhost:9999/');
      await sessionB.page.goto('http://localhost:9999/');

      // Set localStorage in sessionA
      await sessionA.page.evaluate(() => {
        localStorage.setItem('key', 'valueFromA');
      });

      // Check both sessions
      const valueA = await sessionA.page.evaluate(() => localStorage.getItem('key'));
      const valueB = await sessionB.page.evaluate(() => localStorage.getItem('key'));

      expect(valueA).toBe('valueFromA');
      expect(valueB).toBeNull();
    });

    it('should not share sessionStorage between sessions', async () => {
      const sessionA = await sessionManager.createSession({ headless: true });
      const sessionB = await sessionManager.createSession({ headless: true });

      // Use route to serve HTML with proper origin
      const html = '<html><body><h1>Test</h1></body></html>';
      await sessionA.page.route('http://localhost:9999/**', route => {
        route.fulfill({ contentType: 'text/html', body: html });
      });
      await sessionB.page.route('http://localhost:9999/**', route => {
        route.fulfill({ contentType: 'text/html', body: html });
      });

      await sessionA.page.goto('http://localhost:9999/');
      await sessionB.page.goto('http://localhost:9999/');

      // Set sessionStorage in sessionA
      await sessionA.page.evaluate(() => {
        sessionStorage.setItem('key', 'valueFromA');
      });

      // Check both sessions
      const valueA = await sessionA.page.evaluate(() => sessionStorage.getItem('key'));
      const valueB = await sessionB.page.evaluate(() => sessionStorage.getItem('key'));

      expect(valueA).toBe('valueFromA');
      expect(valueB).toBeNull();
    });
  });

  describe('Console Log Isolation', () => {
    it('should not share console logs between sessions', async () => {
      const sessionA = await sessionManager.createSession({ headless: true });
      const sessionB = await sessionManager.createSession({ headless: true });

      await sessionA.page.goto('data:text/html,<h1>A</h1>');
      await sessionB.page.goto('data:text/html,<h1>B</h1>');

      // Generate console log in sessionA
      await sessionA.page.evaluate(() => {
        console.log('Log from session A');
      });

      // Wait for log to be captured
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check logs
      const logsA = sessionA.consoleLogs;
      const logsB = sessionB.consoleLogs;

      expect(logsA.some(l => l.text.includes('session A'))).toBe(true);
      expect(logsB.some(l => l.text.includes('session A'))).toBe(false);
    });
  });

  describe('Network Log Isolation', () => {
    it('should not share network logs between sessions', async () => {
      const sessionA = await sessionManager.createSession({ headless: true });
      const sessionB = await sessionManager.createSession({ headless: true });

      // Navigate to trigger network requests
      await sessionA.page.goto('data:text/html,<h1>A</h1>');
      await sessionB.page.goto('data:text/html,<h1>B</h1>');

      // Each session should only have its own network logs
      const networkLogsA = Array.from(sessionA.networkLogs.values());
      const networkLogsB = Array.from(sessionB.networkLogs.values());

      // Logs should be independent (different request IDs)
      const idsA = new Set(networkLogsA.map(l => l.id));
      const idsB = new Set(networkLogsB.map(l => l.id));

      // No overlap in request IDs
      for (const id of idsA) {
        expect(idsB.has(id)).toBe(false);
      }
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent screenshots without interference', async () => {
      const sessionA = await sessionManager.createSession({ headless: true });
      const sessionB = await sessionManager.createSession({ headless: true });

      await sessionA.page.goto('data:text/html,<body style="background:red"><h1>RED</h1></body>');
      await sessionB.page.goto('data:text/html,<body style="background:blue"><h1>BLUE</h1></body>');

      // Take screenshots concurrently
      const [screenshotA, screenshotB] = await Promise.all([
        sessionA.page.screenshot(),
        sessionB.page.screenshot()
      ]);

      // Both screenshots should be captured (non-empty buffers)
      expect(screenshotA.length).toBeGreaterThan(0);
      expect(screenshotB.length).toBeGreaterThan(0);

      // Screenshots should be different (different content)
      expect(screenshotA.equals(screenshotB)).toBe(false);
    });

    it('should handle concurrent form fills without interference', async () => {
      const sessionA = await sessionManager.createSession({ headless: true });
      const sessionB = await sessionManager.createSession({ headless: true });

      const html = 'data:text/html,<input type="text" id="input">';
      await sessionA.page.goto(html);
      await sessionB.page.goto(html);

      // Fill forms concurrently
      await Promise.all([
        sessionA.page.fill('#input', 'Value A'),
        sessionB.page.fill('#input', 'Value B')
      ]);

      // Check values
      const valueA = await sessionA.page.inputValue('#input');
      const valueB = await sessionB.page.inputValue('#input');

      expect(valueA).toBe('Value A');
      expect(valueB).toBe('Value B');
    });

    it('should handle rapid session creation and operations', async () => {
      // Create 5 sessions rapidly
      const sessions = await Promise.all(
        Array.from({ length: 5 }, () =>
          sessionManager.createSession({ headless: true })
        )
      );

      // Navigate all to different content
      await Promise.all(
        sessions.map((session, i) =>
          session.page.goto(`data:text/html,<h1>Session ${i}</h1>`)
        )
      );

      // Verify all have correct content
      const contents = await Promise.all(
        sessions.map(session => session.page.textContent('h1'))
      );

      contents.forEach((content, i) => {
        expect(content).toBe(`Session ${i}`);
      });

      // All session IDs should be unique
      const ids = new Set(sessions.map(s => s.id));
      expect(ids.size).toBe(5);
    });
  });

  describe('Session ID Uniqueness', () => {
    it('should generate unique session IDs', async () => {
      const sessions = await Promise.all(
        Array.from({ length: 10 }, () =>
          sessionManager.createSession({ headless: true })
        )
      );

      const ids = sessions.map(s => s.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(10);
    });

    it('should use UUID format for session IDs', async () => {
      const session = await sessionManager.createSession({ headless: true });

      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(session.id).toMatch(uuidRegex);
    });
  });
});
