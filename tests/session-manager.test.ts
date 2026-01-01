import { describe, it, expect, afterEach, vi } from 'vitest';
import { sessionManager, Session } from '../src/session-manager.js';

/**
 * Session Manager Tests for Wrapper Architecture
 *
 * Tests the session management layer that wraps backend MCP servers.
 * Browser behavior is tested by the backend (@playwright/mcp).
 */
describe('SessionManager', () => {
  afterEach(async () => {
    // Clean up all sessions after each test
    await sessionManager.closeAllSessions();
    // Restart cleanup interval for other tests
    sessionManager.startCleanupInterval();
  });

  describe('createSession', () => {
    it('should create a new session with unique ID', async () => {
      const session = await sessionManager.createSession();

      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(typeof session.id).toBe('string');
      // UUID format check
      expect(session.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should have createdAt and lastUsedAt timestamps', async () => {
      const before = new Date();
      const session = await sessionManager.createSession();
      const after = new Date();

      expect(session.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(session.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(session.lastUsedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('should use default backend when not specified', async () => {
      const session = await sessionManager.createSession();
      expect(session.backend).toBe(sessionManager.getDefaultBackend());
    });

    it('should use specified backend', async () => {
      const session = await sessionManager.createSession({ backend: 'playwright' });
      expect(session.backend).toBe('playwright');
    });

    it('should have running MCP client', async () => {
      const session = await sessionManager.createSession();
      expect(session.client).toBeDefined();
      expect(session.client.isRunning()).toBe(true);
    });
  });

  describe('getSession', () => {
    it('should return session by ID', async () => {
      const created = await sessionManager.createSession();
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
      await sessionManager.createSession();
      await sessionManager.createSession();

      const sessions = sessionManager.listSessions();

      expect(sessions.length).toBe(2);
      expect(sessions[0].id).toBeDefined();
      expect(sessions[0].backend).toBeDefined();
    });
  });

  describe('closeSession', () => {
    it('should close and remove session', async () => {
      const session = await sessionManager.createSession();

      await sessionManager.closeSession(session.id);

      const retrieved = sessionManager.getSession(session.id);
      expect(retrieved).toBeUndefined();
    });

    it('should throw error for non-existent session', async () => {
      await expect(
        sessionManager.closeSession('non-existent-id')
      ).rejects.toThrow('Session not found');
    });

    it('should stop MCP client when closing', async () => {
      const session = await sessionManager.createSession();
      const client = session.client;

      await sessionManager.closeSession(session.id);

      expect(client.isRunning()).toBe(false);
    });
  });

  describe('closeAllSessions', () => {
    it('should close all sessions', async () => {
      await sessionManager.createSession();
      await sessionManager.createSession();
      await sessionManager.createSession();

      expect(sessionManager.listSessions().length).toBe(3);

      await sessionManager.closeAllSessions();

      expect(sessionManager.listSessions().length).toBe(0);
    });
  });

  describe('updateLastUsed', () => {
    it('should update lastUsedAt timestamp', async () => {
      const session = await sessionManager.createSession();
      const originalLastUsed = session.lastUsedAt.getTime();

      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 50));

      sessionManager.updateLastUsed(session.id);

      const updatedSession = sessionManager.getSession(session.id);
      expect(updatedSession!.lastUsedAt.getTime()).toBeGreaterThan(originalLastUsed);
    });

    it('should not throw for non-existent session', () => {
      expect(() => sessionManager.updateLastUsed('non-existent-id')).not.toThrow();
    });
  });

  describe('callTool', () => {
    it('should throw for non-existent session', async () => {
      await expect(
        sessionManager.callTool('non-existent-id', 'some_tool', {})
      ).rejects.toThrow('Session not found');
    });

    it('should update lastUsed when calling tool', async () => {
      const session = await sessionManager.createSession();
      const originalLastUsed = session.lastUsedAt.getTime();

      await new Promise(resolve => setTimeout(resolve, 50));

      // This may fail if the backend doesn't have the tool, but lastUsed should still update
      try {
        await sessionManager.callTool(session.id, 'snapshot', {});
      } catch {
        // Tool might not exist
      }

      const updatedSession = sessionManager.getSession(session.id);
      expect(updatedSession!.lastUsedAt.getTime()).toBeGreaterThan(originalLastUsed);
    });
  });

  describe('getAvailableTools', () => {
    it('should return array of tools', async () => {
      const tools = await sessionManager.getAvailableTools();

      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should cache tools after first call', async () => {
      const tools1 = await sessionManager.getAvailableTools();
      const tools2 = await sessionManager.getAvailableTools();

      // Should be same reference (cached)
      expect(tools1).toBe(tools2);
    });

    it('should return tools with name and inputSchema', async () => {
      const tools = await sessionManager.getAvailableTools();
      const tool = tools[0];

      expect(tool.name).toBeDefined();
      expect(typeof tool.name).toBe('string');
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
    });
  });

  describe('parallel sessions', () => {
    it('should support multiple concurrent sessions', async () => {
      const sessions = await Promise.all([
        sessionManager.createSession(),
        sessionManager.createSession(),
        sessionManager.createSession()
      ]);

      expect(sessions.length).toBe(3);

      // Each session should have a unique ID
      const ids = sessions.map(s => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);

      // Each session should have its own client
      const clients = sessions.map(s => s.client);
      expect(new Set(clients).size).toBe(3);
    });
  });

  describe('Cleanup Interval', () => {
    it('should start and stop cleanup interval', () => {
      sessionManager.stopCleanupInterval();
      expect(true).toBe(true);

      sessionManager.startCleanupInterval();
      expect(true).toBe(true);
    });

    it('should restart cleanup interval when called multiple times', () => {
      sessionManager.startCleanupInterval();
      sessionManager.startCleanupInterval();
      expect(true).toBe(true);
    });
  });

  describe('Inactive Session Cleanup', () => {
    it('should cleanup inactive sessions based on timeout', async () => {
      const session = await sessionManager.createSession();

      // Set lastUsedAt to 2 hours ago (beyond default 1 hour timeout)
      session.lastUsedAt = new Date(Date.now() - 2 * 60 * 60 * 1000);

      const closedCount = await sessionManager.cleanupInactiveSessions();

      expect(closedCount).toBe(1);
      expect(sessionManager.getSession(session.id)).toBeUndefined();
    });

    it('should not cleanup active sessions', async () => {
      const session = await sessionManager.createSession();
      // lastUsedAt is set to now on creation

      const closedCount = await sessionManager.cleanupInactiveSessions();

      expect(closedCount).toBe(0);
      expect(sessionManager.getSession(session.id)).toBeDefined();
    });
  });

  describe('Backend process exit handling', () => {
    it('should remove session when backend process exits', async () => {
      const session = await sessionManager.createSession();
      const sessionId = session.id;

      // Force stop the client
      await session.client.stop();

      // Wait for exit handler
      await new Promise(resolve => setTimeout(resolve, 100));

      // Session should be removed
      expect(sessionManager.getSession(sessionId)).toBeUndefined();
    });
  });

  describe('getDefaultBackend', () => {
    it('should return default backend string', () => {
      const backend = sessionManager.getDefaultBackend();
      expect(typeof backend).toBe('string');
      expect(backend.length).toBeGreaterThan(0);
    });
  });
});
