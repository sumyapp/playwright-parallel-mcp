import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import { join } from 'path';

/**
 * Mode Configuration Tests
 *
 * Tests that verify Lite/Full mode tool registration works correctly.
 */

// ツールリストを取得するヘルパー関数
async function getToolCount(mode: 'lite' | 'full'): Promise<number> {
  return new Promise((resolve, reject) => {
    const serverPath = join(__dirname, '..', 'dist', 'index.js');

    const proc = spawn('node', [serverPath], {
      env: {
        ...process.env,
        PLAYWRIGHT_PARALLEL_MODE: mode
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();

      // tools/listのレスポンスをパース
      const lines = stdout.split('\n');
      for (const line of lines) {
        if (line.includes('"tools"')) {
          try {
            // JSON-RPCレスポンスを探す
            const jsonMatch = line.match(/\{.*"tools".*\}/);
            if (jsonMatch) {
              const response = JSON.parse(jsonMatch[0]);
              if (response.result?.tools) {
                proc.kill();
                resolve(response.result.tools.length);
                return;
              }
            }
          } catch {
            // パース失敗は無視
          }
        }
      }
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
      // サーバー起動を確認
      if (stderr.includes('playwright-parallel-mcp server started')) {
        // tools/listリクエストを送信
        const request = JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
          params: {}
        });
        proc.stdin.write(request + '\n');
      }
    });

    proc.on('error', reject);

    // タイムアウト
    setTimeout(() => {
      proc.kill();
      reject(new Error(`Timeout. stderr: ${stderr}, stdout: ${stdout}`));
    }, 10000);
  });
}

describe('Mode Configuration', () => {
  it('should register 22 tools in Lite mode', async () => {
    const toolCount = await getToolCount('lite');
    expect(toolCount).toBe(22);
  });

  it('should register 63 tools in Full mode', async () => {
    const toolCount = await getToolCount('full');
    expect(toolCount).toBe(63);
  });
});
