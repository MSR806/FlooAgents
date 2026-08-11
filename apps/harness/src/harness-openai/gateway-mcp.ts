import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { gatewayPost } from "../gateway-http.ts";

export { gatewayPost } from "../gateway-http.ts";

export function createGatewayMcpServer(url: string, token: string, fetchFn = fetch): McpServer {
  const server = new McpServer({ name: "tool-gateway", version: "0.0.0" });

  server.registerTool(
    "gateway_catalog",
    {
      description: "List tools available through the tool gateway.",
      inputSchema: z.object({ query: z.string().optional() }),
      annotations: { readOnlyHint: true },
    },
    async ({ query }) =>
      asToolResult(await gatewayPost(url, token, "/catalog", { query }, fetchFn)),
  );

  server.registerTool(
    "gateway_invoke",
    {
      description: "Invoke one tool through the tool gateway.",
      inputSchema: z.object({
        tool: z.string(),
        input: z.record(z.string(), z.unknown()).optional(),
      }),
    },
    async ({ tool, input }) =>
      asToolResult(await gatewayPost(url, token, "/invoke", { tool, input: input ?? {} }, fetchFn)),
  );

  return server;
}

function asToolResult(result: { ok: boolean; data: unknown }) {
  const error = (result.data as { error?: unknown } | null)?.error;
  return {
    content: [{ type: "text" as const, text: JSON.stringify(result.data) }],
    ...(!result.ok || error !== undefined ? { isError: true } : {}),
  };
}

export async function runGatewayMcpServer(): Promise<void> {
  const url = process.env.TOOL_GATEWAY_URL;
  const token = process.env.TOOL_GATEWAY_TOKEN;
  if (!url || !token) throw new Error("TOOL_GATEWAY_URL and TOOL_GATEWAY_TOKEN are required");

  const server = createGatewayMcpServer(url, token);
  await server.connect(new StdioServerTransport());
}

if (import.meta.main) await runGatewayMcpServer();
