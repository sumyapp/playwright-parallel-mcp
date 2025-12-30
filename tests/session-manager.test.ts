import { describe, it, expect, afterEach } from 'vitest';
import { sessionManager } from '../src/session-manager.js';

describe('SessionManager', () => {
  afterEach(async () => {
    // Clean up all sessions after each test
    const sessions = sessionManager.listSessions();
    for (const session of sessions) {
      await sessionManager.closeSession(session.id);
    }
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

    it('should create sessions with different browsers', async () => {
      const chromiumSession = await sessionManager.createSession({
        browser: 'chromium',
        headless: true
      });

      expect(chromiumSession.browserType).toBe('chromium');
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
});
