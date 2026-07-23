import { expect, test } from "bun:test";
import type { InvocationRequest, InvocationResult, StreamEvent } from "@gilly/harness-protocol";
import { createServer, type HarnessRunners } from "./server.ts";

const completed = (finalText: string): InvocationResult => ({
  status: "completed",
  finalText,
  harnessSessionId: null,
  error: null,
});

const emptyStream = async function* (): AsyncIterable<StreamEvent> {};

function request(modelType?: "anthropic" | "openai"): InvocationRequest {
  return {
    ...(modelType ? { modelType } : {}),
    agent: { id: "a", name: "A", model: "test-model", systemPrompt: "do x" },
    userMessage: "hello",
  };
}

function runners(
  anthropicRun: HarnessRunners["anthropic"]["runLoop"] = async () => completed("claude"),
  openaiRun: HarnessRunners["openai"]["runLoop"] = async () => completed("openai"),
): HarnessRunners {
  return {
    anthropic: { runLoop: anthropicRun, runStream: emptyStream },
    openai: { runLoop: openaiRun, runStream: emptyStream },
  };
}

test("GET /ping returns Healthy", async () => {
  const res = await createServer(runners()).fetch(new Request("http://localhost/ping"));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ status: "Healthy" });
});

test("POST /invocations rejects a malformed body with 400", async () => {
  const res = await createServer().fetch(
    new Request("http://localhost/invocations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nope: true }),
    }),
  );
  expect(res.status).toBe(400);
});

test("POST /invocations defaults to Anthropic and dispatches explicit OpenAI requests", async () => {
  const called: string[] = [];
  const server = createServer(
    runners(
      async () => {
        called.push("anthropic");
        return completed("claude");
      },
      async () => {
        called.push("openai");
        return completed("openai");
      },
    ),
  );

  for (const invocation of [request(), request("openai")]) {
    const res = await server.fetch(
      new Request("http://localhost/invocations", {
        method: "POST",
        body: JSON.stringify(invocation),
      }),
    );
    expect(res.status).toBe(200);
  }
  expect(called).toEqual(["anthropic", "openai"]);
});

test("POST /invocations/stream dispatches OpenAI and cancels its source", async () => {
  let cancelled = false;
  async function* openaiStream(): AsyncIterable<StreamEvent> {
    try {
      yield { type: "token", text: "hello" };
      await new Promise(() => {});
    } finally {
      cancelled = true;
    }
  }
  const configured = runners();
  configured.openai.runStream = openaiStream;
  const res = await createServer(configured).fetch(
    new Request("http://localhost/invocations/stream", {
      method: "POST",
      body: JSON.stringify(request("openai")),
    }),
  );
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toBe("application/x-ndjson");
  const reader = res.body?.getReader();
  expect(new TextDecoder().decode((await reader?.read())?.value)).toBe(
    '{"type":"token","text":"hello"}\n',
  );
  await reader?.cancel();
  expect(cancelled).toBe(true);
});
