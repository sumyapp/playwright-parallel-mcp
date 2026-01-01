import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { McpTool, DEFAULT_BACKENDS } from '../src/types.js';

/**
 * Tool Registration Tests
 *
 * Tests for the tool schema conversion logic used in index.ts.
 * Since index.ts is the entry point, we test the schema conversion logic separately.
 */
describe('Tool Registration Logic', () => {
  /**
   * JSON Schema to Zod conversion helper (mirrors logic from index.ts)
   */
  function convertJsonSchemaToZod(tool: McpTool): Record<string, z.ZodTypeAny> {
    const wrappedSchema: Record<string, z.ZodTypeAny> = {
      sessionId: z.string().describe("The session ID to use for this operation")
    };

    if (tool.inputSchema.properties) {
      for (const [key, value] of Object.entries(tool.inputSchema.properties)) {
        const prop = value as { type?: string; description?: string; enum?: string[]; default?: unknown };

        let zodSchema: z.ZodTypeAny;

        switch (prop.type) {
          case "string":
            zodSchema = prop.enum
              ? z.enum(prop.enum as [string, ...string[]])
              : z.string();
            break;
          case "number":
          case "integer":
            zodSchema = z.number();
            break;
          case "boolean":
            zodSchema = z.boolean();
            break;
          case "array":
            zodSchema = z.array(z.unknown());
            break;
          case "object":
            zodSchema = z.record(z.unknown());
            break;
          default:
            zodSchema = z.unknown();
        }

        if (prop.description) {
          zodSchema = zodSchema.describe(prop.description);
        }

        const isRequired = tool.inputSchema.required?.includes(key);
        if (!isRequired) {
          zodSchema = zodSchema.optional();
        }

        wrappedSchema[key] = zodSchema;
      }
    }

    return wrappedSchema;
  }

  describe('Schema Conversion', () => {
    it('should always add sessionId as required string', () => {
      const tool: McpTool = {
        name: 'test_tool',
        inputSchema: { type: 'object' }
      };

      const schema = convertJsonSchemaToZod(tool);
      expect(schema.sessionId).toBeDefined();

      // sessionId should accept string
      const sessionIdSchema = z.object({ sessionId: schema.sessionId });
      expect(() => sessionIdSchema.parse({ sessionId: 'test-id' })).not.toThrow();
      expect(() => sessionIdSchema.parse({ sessionId: 123 })).toThrow();
    });

    it('should convert string type correctly', () => {
      const tool: McpTool = {
        name: 'test_tool',
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'The URL' }
          },
          required: ['url']
        }
      };

      const schema = convertJsonSchemaToZod(tool);
      expect(schema.url).toBeDefined();

      const urlSchema = z.object({ url: schema.url });
      expect(() => urlSchema.parse({ url: 'https://example.com' })).not.toThrow();
      expect(() => urlSchema.parse({ url: 123 })).toThrow();
    });

    it('should convert string enum correctly', () => {
      const tool: McpTool = {
        name: 'test_tool',
        inputSchema: {
          type: 'object',
          properties: {
            browser: { type: 'string', enum: ['chromium', 'firefox', 'webkit'] }
          },
          required: ['browser']
        }
      };

      const schema = convertJsonSchemaToZod(tool);
      const browserSchema = z.object({ browser: schema.browser });

      expect(() => browserSchema.parse({ browser: 'chromium' })).not.toThrow();
      expect(() => browserSchema.parse({ browser: 'firefox' })).not.toThrow();
      expect(() => browserSchema.parse({ browser: 'webkit' })).not.toThrow();
      expect(() => browserSchema.parse({ browser: 'invalid' })).toThrow();
    });

    it('should convert number type correctly', () => {
      const tool: McpTool = {
        name: 'test_tool',
        inputSchema: {
          type: 'object',
          properties: {
            timeout: { type: 'number', description: 'Timeout in ms' }
          },
          required: ['timeout']
        }
      };

      const schema = convertJsonSchemaToZod(tool);
      const timeoutSchema = z.object({ timeout: schema.timeout });

      expect(() => timeoutSchema.parse({ timeout: 5000 })).not.toThrow();
      expect(() => timeoutSchema.parse({ timeout: 'fast' })).toThrow();
    });

    it('should convert integer type as number', () => {
      const tool: McpTool = {
        name: 'test_tool',
        inputSchema: {
          type: 'object',
          properties: {
            count: { type: 'integer' }
          },
          required: ['count']
        }
      };

      const schema = convertJsonSchemaToZod(tool);
      const countSchema = z.object({ count: schema.count });

      expect(() => countSchema.parse({ count: 10 })).not.toThrow();
      expect(() => countSchema.parse({ count: 3.14 })).not.toThrow(); // Zod doesn't distinguish int/float
    });

    it('should convert boolean type correctly', () => {
      const tool: McpTool = {
        name: 'test_tool',
        inputSchema: {
          type: 'object',
          properties: {
            fullPage: { type: 'boolean', description: 'Capture full page' }
          },
          required: ['fullPage']
        }
      };

      const schema = convertJsonSchemaToZod(tool);
      const fullPageSchema = z.object({ fullPage: schema.fullPage });

      expect(() => fullPageSchema.parse({ fullPage: true })).not.toThrow();
      expect(() => fullPageSchema.parse({ fullPage: false })).not.toThrow();
      expect(() => fullPageSchema.parse({ fullPage: 'true' })).toThrow();
    });

    it('should convert array type correctly', () => {
      const tool: McpTool = {
        name: 'test_tool',
        inputSchema: {
          type: 'object',
          properties: {
            files: { type: 'array', description: 'List of files' }
          },
          required: ['files']
        }
      };

      const schema = convertJsonSchemaToZod(tool);
      const filesSchema = z.object({ files: schema.files });

      expect(() => filesSchema.parse({ files: ['a.txt', 'b.txt'] })).not.toThrow();
      expect(() => filesSchema.parse({ files: [1, 2, 3] })).not.toThrow();
      expect(() => filesSchema.parse({ files: 'not-array' })).toThrow();
    });

    it('should convert object type correctly', () => {
      const tool: McpTool = {
        name: 'test_tool',
        inputSchema: {
          type: 'object',
          properties: {
            headers: { type: 'object', description: 'HTTP headers' }
          },
          required: ['headers']
        }
      };

      const schema = convertJsonSchemaToZod(tool);
      const headersSchema = z.object({ headers: schema.headers });

      expect(() => headersSchema.parse({ headers: { 'Content-Type': 'application/json' } })).not.toThrow();
      expect(() => headersSchema.parse({ headers: 'not-object' })).toThrow();
    });

    it('should handle unknown type as z.unknown', () => {
      const tool: McpTool = {
        name: 'test_tool',
        inputSchema: {
          type: 'object',
          properties: {
            custom: { type: 'custom-type' as string }
          },
          required: ['custom']
        }
      };

      const schema = convertJsonSchemaToZod(tool);
      const customSchema = z.object({ custom: schema.custom });

      // z.unknown() accepts anything
      expect(() => customSchema.parse({ custom: 'string' })).not.toThrow();
      expect(() => customSchema.parse({ custom: 123 })).not.toThrow();
      expect(() => customSchema.parse({ custom: { key: 'value' } })).not.toThrow();
    });

    it('should make optional properties optional', () => {
      const tool: McpTool = {
        name: 'test_tool',
        inputSchema: {
          type: 'object',
          properties: {
            required_param: { type: 'string' },
            optional_param: { type: 'string' }
          },
          required: ['required_param']
        }
      };

      const schema = convertJsonSchemaToZod(tool);
      const testSchema = z.object({
        sessionId: schema.sessionId,
        required_param: schema.required_param,
        optional_param: schema.optional_param
      });

      // With both params
      expect(() => testSchema.parse({
        sessionId: 'id',
        required_param: 'value',
        optional_param: 'value'
      })).not.toThrow();

      // Without optional param
      expect(() => testSchema.parse({
        sessionId: 'id',
        required_param: 'value'
      })).not.toThrow();

      // Without required param - should fail
      expect(() => testSchema.parse({
        sessionId: 'id',
        optional_param: 'value'
      })).toThrow();
    });

    it('should handle empty properties', () => {
      const tool: McpTool = {
        name: 'test_tool',
        inputSchema: {
          type: 'object'
        }
      };

      const schema = convertJsonSchemaToZod(tool);
      expect(Object.keys(schema)).toEqual(['sessionId']);
    });
  });

  describe('DEFAULT_BACKENDS', () => {
    it('should have playwright backend configured', () => {
      expect(DEFAULT_BACKENDS.playwright).toBeDefined();
      expect(DEFAULT_BACKENDS.playwright.command).toBe('npx');
      expect(DEFAULT_BACKENDS.playwright.args).toContain('@playwright/mcp@latest');
    });

    it('should have chrome-devtools backend configured', () => {
      expect(DEFAULT_BACKENDS['chrome-devtools']).toBeDefined();
      expect(DEFAULT_BACKENDS['chrome-devtools'].command).toBe('npx');
      expect(DEFAULT_BACKENDS['chrome-devtools'].args).toContain('chrome-devtools-mcp@latest');
    });

    it('should use @latest version for all backends', () => {
      for (const [name, config] of Object.entries(DEFAULT_BACKENDS)) {
        const hasLatest = config.args.some(arg => arg.includes('@latest'));
        expect(hasLatest).toBe(true);
      }
    });
  });

  describe('Content Type Conversion', () => {
    /**
     * Content conversion helper (mirrors logic from index.ts)
     */
    function convertContent(content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>) {
      return content.map(c => {
        if (c.type === "image" && c.data && c.mimeType) {
          return { type: "image" as const, data: c.data, mimeType: c.mimeType };
        }
        return { type: "text" as const, text: c.text || "" };
      });
    }

    it('should convert text content correctly', () => {
      const input = [{ type: 'text', text: 'Hello World' }];
      const result = convertContent(input);

      expect(result).toEqual([{ type: 'text', text: 'Hello World' }]);
    });

    it('should convert image content correctly', () => {
      const input = [{
        type: 'image',
        data: 'base64data',
        mimeType: 'image/png'
      }];
      const result = convertContent(input);

      expect(result).toEqual([{
        type: 'image',
        data: 'base64data',
        mimeType: 'image/png'
      }]);
    });

    it('should handle missing text as empty string', () => {
      const input = [{ type: 'text' }];
      const result = convertContent(input);

      expect(result).toEqual([{ type: 'text', text: '' }]);
    });

    it('should treat incomplete image as text', () => {
      // Image without data
      const input1 = [{ type: 'image', mimeType: 'image/png' }];
      const result1 = convertContent(input1);
      expect(result1[0].type).toBe('text');

      // Image without mimeType
      const input2 = [{ type: 'image', data: 'base64data' }];
      const result2 = convertContent(input2);
      expect(result2[0].type).toBe('text');
    });

    it('should handle mixed content', () => {
      const input = [
        { type: 'text', text: 'Screenshot:' },
        { type: 'image', data: 'base64data', mimeType: 'image/png' },
        { type: 'text', text: 'Done' }
      ];
      const result = convertContent(input);

      expect(result.length).toBe(3);
      expect(result[0]).toEqual({ type: 'text', text: 'Screenshot:' });
      expect(result[1]).toEqual({ type: 'image', data: 'base64data', mimeType: 'image/png' });
      expect(result[2]).toEqual({ type: 'text', text: 'Done' });
    });
  });
});
