import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sessionManager } from '../src/session-manager.js';
import type { Session } from '../src/session-manager.js';

describe('Navigation', () => {
  let session: Session;

  beforeAll(async () => {
    session = await sessionManager.createSession({
      browser: 'chromium',
      headless: true
    });
  });

  afterAll(async () => {
    await sessionManager.closeSession(session.id);
  });

  describe('page.goto', () => {
    it('should navigate to a URL', async () => {
      const response = await session.page.goto('https://example.com');

      expect(response?.status()).toBe(200);
      expect(session.page.url()).toBe('https://example.com/');
    });

    it('should get page title', async () => {
      await session.page.goto('https://example.com');

      const title = await session.page.title();

      expect(title).toBe('Example Domain');
    });
  });

  describe('history navigation', () => {
    it('should go back and forward', async () => {
      await session.page.goto('https://example.com');
      await session.page.goto('https://httpbin.org/get');

      expect(session.page.url()).toContain('httpbin.org');

      await session.page.goBack();
      expect(session.page.url()).toBe('https://example.com/');

      await session.page.goForward();
      expect(session.page.url()).toContain('httpbin.org');
    });
  });

  describe('reload', () => {
    it('should reload the page', async () => {
      await session.page.goto('https://example.com');

      const response = await session.page.reload();

      expect(response?.status()).toBe(200);
      expect(session.page.url()).toBe('https://example.com/');
    });
  });
});
