import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sessionManager } from '../src/session-manager.js';
import type { Session } from '../src/session-manager.js';

describe('Console Logs', () => {
  let session: Session;

  beforeAll(async () => {
    session = await sessionManager.createSession({
      browser: 'chromium',
      headless: true
    });
    await session.page.goto('about:blank');
  });

  afterAll(async () => {
    await sessionManager.closeSession(session.id);
  });

  it('should capture console.log', async () => {
    await session.page.evaluate(() => {
      console.log('test message');
    });

    // Wait a bit for the event to be processed
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(session.consoleLogs.length).toBeGreaterThan(0);
    const logEntry = session.consoleLogs.find(l => l.text === 'test message');
    expect(logEntry).toBeDefined();
    expect(logEntry?.type).toBe('log');
  });

  it('should capture console.error', async () => {
    await session.page.evaluate(() => {
      console.error('error message');
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    const errorEntry = session.consoleLogs.find(l => l.text === 'error message');
    expect(errorEntry).toBeDefined();
    expect(errorEntry?.type).toBe('error');
  });

  it('should capture console.warn', async () => {
    await session.page.evaluate(() => {
      console.warn('warning message');
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    const warnEntry = session.consoleLogs.find(l => l.text === 'warning message');
    expect(warnEntry).toBeDefined();
    expect(warnEntry?.type).toBe('warn');
  });

  it('should include timestamp in log entries', async () => {
    await session.page.evaluate(() => {
      console.log('timestamped message');
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    const entry = session.consoleLogs.find(l => l.text === 'timestamped message');
    expect(entry?.timestamp).toBeDefined();
    expect(new Date(entry!.timestamp).getTime()).toBeGreaterThan(0);
  });
});
