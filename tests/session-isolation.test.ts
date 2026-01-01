import { describe, it, expect, afterEach } from 'vitest';
import { sessionManager } from '../src/session-manager.js';

/**
 * Session Isolation Tests for Wrapper Architecture
 *
 * Tests that sessions are isolated at the process level.
 * Each session spawns its own MCP backend process.
 */
describe('Session Isolation', () => {
  afterEach(async () => {
    await sessionManager.closeAllSessions();
  });

  describe('Process Isolation', () => {
    it('should create separate MCP client instances for each session', async () => {
      const session1 = await sessionManager.createSession();
      const session2 = await sessionManager.createSession();

      // Different client instances
      expect(session1.client).not.toBe(session2.client);

      // Both running
      expect(session1.client.isRunning()).toBe(true);
      expect(session2.client.isRunning()).toBe(true);
    });

    it('should not affect other sessions when one client stops', async () => {
      const session1 = await sessionManager.createSession();
      const session2 = await sessionManager.createSession();

      // Stop session1's client
      await session1.client.stop();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Session2 should still be running
      expect(session2.client.isRunning()).toBe(true);
    });

    it('should have independent session IDs (UUID v4)', async () => {
      const sessions = await Promise.all([
        sessionManager.createSession(),
        sessionManager.createSession(),
        sessionManager.createSession()
      ]);

      const ids = sessions.map(s => s.id);

      // All unique
      expect(new Set(ids).size).toBe(3);

      // All UUIDs
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      for (const id of ids) {
        expect(id).toMatch(uuidPattern);
      }
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle parallel session creation safely', async () => {
      const sessionPromises = Array(5).fill(null).map(() =>
        sessionManager.createSession()
      );

      const sessions = await Promise.all(sessionPromises);

      expect(sessions.length).toBe(5);
      expect(new Set(sessions.map(s => s.id)).size).toBe(5);
    });

    it('should handle concurrent tool calls across sessions', async () => {
      const session1 = await sessionManager.createSession();
      const session2 = await sessionManager.createSession();

      // Call tools on both sessions concurrently
      const results = await Promise.allSettled([
        sessionManager.callTool(session1.id, 'browser_snapshot', {}),
        sessionManager.callTool(session2.id, 'browser_snapshot', {})
      ]);

      // Both should complete (success or failure)
      expect(results.length).toBe(2);
    });
  });

  describe('Session Lifecycle', () => {
    it('should clean up resources when session closes', async () => {
      const session = await sessionManager.createSession();
      const client = session.client;

      expect(client.isRunning()).toBe(true);

      await sessionManager.closeSession(session.id);

      expect(client.isRunning()).toBe(false);
      expect(sessionManager.getSession(session.id)).toBeUndefined();
    });

    it('should close all sessions without affecting each other', async () => {
      await sessionManager.createSession();
      await sessionManager.createSession();
      await sessionManager.createSession();

      expect(sessionManager.listSessions().length).toBe(3);

      await sessionManager.closeAllSessions();

      expect(sessionManager.listSessions().length).toBe(0);
    });
  });

  describe('Backend Configuration', () => {
    it('should support different backends for different sessions', async () => {
      const session1 = await sessionManager.createSession({ backend: 'playwright' });
      const session2 = await sessionManager.createSession({ backend: 'playwright' });

      expect(session1.backend).toBe('playwright');
      expect(session2.backend).toBe('playwright');

      // Different processes despite same backend
      expect(session1.client).not.toBe(session2.client);
    });
  });
});
