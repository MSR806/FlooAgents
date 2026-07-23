import { expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createGatewayMcpServer, gatewayPost } from "./gateway-mcp.ts";

test("gatewayPost authenticates and forwards JSON to the Gilly gateway", async () => {
  let seen: { url: string; init: RequestInit } | undefined;
  const fakeFetch = (async (url: string, init: RequestInit) => {
    seen = { url, init };
    return new Response(JSON.stringify({ tools: [] }));
  }) as unknown as typeof fetch;

  expect(
    await gatewayPost("http://gateway", "token", "/catalog", { query: "git" }, fakeFetch),
  ).toEqual({
    ok: true,
    data: { tools: [] },
  });
  expect(seen?.url).toBe("http://gateway/catalog");
  expect((seen?.init.headers as Record<string, string>).authorization).toBe("Bearer token");
  expect(seen?.init.body).toBe(JSON.stringify({ query: "git" }));
});

test("the MCP bridge lists and invokes Gilly gateway tools", async () => {
  const requests: { url: string; body: unknown }[] = [];
  const fakeFetch = (async (url: string, init: RequestInit) => {
    requests.push({ url, body: JSON.parse(String(init.body)) });
    return new Response(JSON.stringify({ ok: true }));
  }) as unknown as typeof fetch;
  const server = createGatewayMcpServer("http://gateway", "token", fakeFetch);
  const client = new Client({ name: "test", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  expect((await client.listTools()).tools.map(({ name }) => name)).toEqual([
    "gateway_catalog",
    "gateway_invoke",
  ]);
  const result = await client.callTool({
    name: "gateway_invoke",
    arguments: { tool: "github.create_issue", input: { title: "Test" } },
  });
  expect(result).toMatchObject({ content: [{ type: "text", text: '{"ok":true}' }] });
  expect(requests).toEqual([
    {
      url: "http://gateway/invoke",
      body: { tool: "github.create_issue", input: { title: "Test" } },
    },
  ]);

  await Promise.all([client.close(), server.close()]);
});

test("gateway_invoke defaults omitted tool input to an empty object", async () => {
  const requests: unknown[] = [];
  const fakeFetch = (async (_url: string, init: RequestInit) => {
    requests.push(JSON.parse(String(init.body)));
    return new Response(JSON.stringify({ ok: true }));
  }) as unknown as typeof fetch;
  const server = createGatewayMcpServer("http://gateway", "token", fakeFetch);
  const client = new Client({ name: "test", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  await client.callTool({ name: "gateway_invoke", arguments: { tool: "gilly.list_agents" } });
  expect(requests).toEqual([{ tool: "gilly.list_agents", input: {} }]);
  await Promise.all([client.close(), server.close()]);
});
