import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

/** Call Gilly's run-scoped gateway HTTP API from the Codex-facing MCP bridge. */
export async function gatewayPost(
  url: string,
  token: string,
  path: string,
  body: unknown,
  fetchFn = fetch,
): Promise<{ ok: boolean; data: unknown }> {
  const response = await fetchFn(`${url}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return { ok: response.ok, data: await response.json() };
}

export function createGatewayMcpServer(url: string, token: string, fetchFn = fetch): McpServer {
  const server = new McpServer({ name: "gilly-gateway", version: "0.0.0" });

  server.registerTool(
    "gateway_catalog",
    {
      description: "List tools available through Gilly's gateway.",
      inputSchema: z.object({ query: z.string().optional() }),
      annotations: { readOnlyHint: true },
    },
    async ({ query }) =>
      asToolResult(await gatewayPost(url, token, "/catalog", { query }, fetchFn)),
  );

  server.registerTool(
    "gateway_invoke",
    {
      description: "Invoke one tool through Gilly's gateway.",
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
  const url = process.env.GILLY_GATEWAY_URL;
  const token = process.env.GILLY_GATEWAY_TOKEN;
  if (!url || !token) throw new Error("GILLY_GATEWAY_URL and GILLY_GATEWAY_TOKEN are required");

  const server = createGatewayMcpServer(url, token);
  await server.connect(new StdioServerTransport());
}

if (import.meta.main) await runGatewayMcpServer();
