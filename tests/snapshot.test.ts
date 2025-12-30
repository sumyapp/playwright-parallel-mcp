import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sessionManager } from '../src/session-manager.js';
import type { Session } from '../src/session-manager.js';

describe('Snapshot', () => {
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

  describe('ariaSnapshot', () => {
    it('should get accessibility snapshot', async () => {
      await session.page.goto('https://example.com');

      const snapshot = await session.page.locator('body').ariaSnapshot();

      expect(snapshot).toBeDefined();
      expect(typeof snapshot).toBe('string');
      expect(snapshot.length).toBeGreaterThan(0);
    });

    it('should contain page content in snapshot', async () => {
      await session.page.goto('https://example.com');

      const snapshot = await session.page.locator('body').ariaSnapshot();

      // Example.com has "Example Domain" heading
      expect(snapshot.toLowerCase()).toContain('example');
    });
  });

  describe('screenshot', () => {
    it('should take a screenshot', async () => {
      await session.page.goto('https://example.com');

      const buffer = await session.page.screenshot({ type: 'png' });

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should take full page screenshot', async () => {
      await session.page.goto('https://example.com');

      const buffer = await session.page.screenshot({
        type: 'png',
        fullPage: true
      });

      expect(buffer).toBeInstanceOf(Buffer);
    });
  });

  describe('content extraction', () => {
    it('should get text content', async () => {
      await session.page.goto('https://example.com');

      const content = await session.page.textContent('body');

      expect(content).toContain('Example Domain');
    });

    it('should get HTML content', async () => {
      await session.page.goto('https://example.com');

      const html = await session.page.content();

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Example Domain');
    });
  });
});
