import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createWorkspaceMcpServer } from "./workspace-mcp.ts";

async function workspaceClient(root: string) {
  const server = createWorkspaceMcpServer(root);
  const client = new Client({ name: "test", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

test("workspace MCP tools read, find, write, and edit only workspace files", async () => {
  const root = mkdtempSync(join(tmpdir(), "gilly-workspace-mcp-"));
  writeFileSync(join(root, "notes.txt"), "alpha\nbeta\n");
  const { client, server } = await workspaceClient(root);

  expect(
    await client.callTool({ name: "read_file", arguments: { path: "notes.txt" } }),
  ).toMatchObject({ content: [{ type: "text", text: "alpha\nbeta\n" }] });
  expect(await client.callTool({ name: "glob", arguments: { pattern: "*.txt" } })).toMatchObject({
    content: [{ type: "text", text: "notes.txt" }],
  });
  expect(
    await client.callTool({ name: "grep", arguments: { pattern: "beta", path: "*.txt" } }),
  ).toMatchObject({ content: [{ type: "text", text: "notes.txt:2:beta" }] });
  await client.callTool({
    name: "write_file",
    arguments: { path: "new.txt", contents: "before" },
  });
  await client.callTool({
    name: "edit_file",
    arguments: { path: "new.txt", oldText: "before", newText: "after" },
  });
  expect(readFileSync(join(root, "new.txt"), "utf8")).toBe("after");
  await Promise.all([client.close(), server.close()]);
});

test("workspace MCP tools reject traversal and symlink escapes", async () => {
  const root = mkdtempSync(join(tmpdir(), "gilly-workspace-mcp-"));
  const outside = mkdtempSync(join(tmpdir(), "gilly-workspace-outside-"));
  writeFileSync(join(outside, "secret.txt"), "secret");
  symlinkSync(outside, join(root, "linked"));
  const { client, server } = await workspaceClient(root);

  expect(
    await client.callTool({ name: "read_file", arguments: { path: "../secret.txt" } }),
  ).toMatchObject({ isError: true });
  expect(
    await client.callTool({ name: "read_file", arguments: { path: "linked/secret.txt" } }),
  ).toMatchObject({ isError: true });
  await Promise.all([client.close(), server.close()]);
});
