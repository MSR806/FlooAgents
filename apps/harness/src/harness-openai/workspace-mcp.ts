import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const MAX_READ_BYTES = 1_000_000;
const MAX_MATCHES = 500;

/** Build filesystem tools constrained to one invocation workspace. */
export function createWorkspaceMcpServer(workspace: string): McpServer {
  const root = resolve(workspace);
  const server = new McpServer({ name: "gilly-workspace", version: "0.0.0" });

  server.registerTool(
    "read_file",
    {
      description: "Read a UTF-8 file from the agent workspace.",
      inputSchema: z.object({ path: z.string().min(1) }),
      annotations: { readOnlyHint: true },
    },
    async ({ path }) => textResult(readWorkspaceFile(root, path)),
  );

  server.registerTool(
    "glob",
    {
      description: "List workspace files matching a glob pattern.",
      inputSchema: z.object({ pattern: z.string().min(1) }),
      annotations: { readOnlyHint: true },
    },
    async ({ pattern }) => textResult((await globWorkspace(root, pattern)).join("\n")),
  );

  server.registerTool(
    "grep",
    {
      description: "Search UTF-8 workspace files with a regular expression.",
      inputSchema: z.object({ pattern: z.string().min(1), path: z.string().optional() }),
      annotations: { readOnlyHint: true },
    },
    async ({ pattern, path }) => textResult((await grepWorkspace(root, pattern, path)).join("\n")),
  );

  server.registerTool(
    "write_file",
    {
      description: "Write a UTF-8 file inside the agent workspace.",
      inputSchema: z.object({ path: z.string().min(1), contents: z.string() }),
    },
    async ({ path, contents }) => {
      writeWorkspaceFile(root, path, contents);
      return textResult(path);
    },
  );

  server.registerTool(
    "edit_file",
    {
      description: "Replace one exact text occurrence in a workspace file.",
      inputSchema: z.object({
        path: z.string().min(1),
        oldText: z.string().min(1),
        newText: z.string(),
      }),
    },
    async ({ path, oldText, newText }) => {
      const contents = readWorkspaceFile(root, path);
      const first = contents.indexOf(oldText);
      if (first < 0) throw new Error(`Text not found in ${path}`);
      if (contents.indexOf(oldText, first + oldText.length) >= 0) {
        throw new Error(`Text is not unique in ${path}`);
      }
      writeWorkspaceFile(
        root,
        path,
        `${contents.slice(0, first)}${newText}${contents.slice(first + oldText.length)}`,
      );
      return textResult(path);
    },
  );

  return server;
}

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function readWorkspaceFile(root: string, path: string): string {
  const file = workspacePath(root, path);
  assertNoSymlinkChain(root, file);
  const contents = readFileSync(file);
  if (contents.byteLength > MAX_READ_BYTES) throw new Error(`File is too large to read: ${path}`);
  return contents.toString("utf8");
}

function writeWorkspaceFile(root: string, path: string, contents: string): void {
  const file = workspacePath(root, path);
  assertNoSymlinkChain(root, file);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, contents);
}

async function globWorkspace(root: string, pattern: string): Promise<string[]> {
  safeRelativePattern(pattern);
  const matches: string[] = [];
  for await (const path of new Bun.Glob(pattern).scan({
    cwd: root,
    onlyFiles: true,
    followSymlinks: false,
  })) {
    matches.push(path);
    if (matches.length >= MAX_MATCHES) break;
  }
  return matches.sort();
}

async function grepWorkspace(root: string, pattern: string, path = "**/*"): Promise<string[]> {
  const regex = new RegExp(pattern);
  const matches: string[] = [];
  for (const file of await globWorkspace(root, path)) {
    let contents: string;
    try {
      contents = readWorkspaceFile(root, file);
    } catch {
      continue;
    }
    for (const [index, line] of contents.split("\n").entries()) {
      regex.lastIndex = 0;
      if (regex.test(line)) matches.push(`${file}:${index + 1}:${line}`);
      if (matches.length >= MAX_MATCHES) return matches;
    }
  }
  return matches;
}

function workspacePath(root: string, path: string): string {
  safeRelativePattern(path);
  const destination = resolve(root, path);
  if (!destination.startsWith(`${root}${sep}`)) throw new Error(`Path escapes workspace: ${path}`);
  return destination;
}

function safeRelativePattern(path: string): void {
  if (
    !path ||
    path.startsWith("/") ||
    path.includes("\\") ||
    path.split("/").some((segment) => segment === "." || segment === "..")
  ) {
    throw new Error(`Unsafe workspace path: ${path}`);
  }
}

function assertNoSymlinkChain(root: string, destination: string): void {
  let current = root;
  for (const segment of relative(root, destination).split(sep).filter(Boolean)) {
    current = join(current, segment);
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) {
      throw new Error(`Symbolic links are not allowed in workspace paths: ${current}`);
    }
  }
}

export async function runWorkspaceMcpServer(): Promise<void> {
  const workspace = process.env.GILLY_WORKSPACE_DIR;
  if (!workspace) throw new Error("GILLY_WORKSPACE_DIR is required");
  await createWorkspaceMcpServer(workspace).connect(new StdioServerTransport());
}

if (import.meta.main) await runWorkspaceMcpServer();
