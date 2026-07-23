import { expect, test } from "bun:test";
import type { InvocationRequest, InvocationResult, StreamEvent } from "@gilly/harness-protocol";
import type { RuntimeProvider } from "./provider.ts";
import { RoutingRuntimeProvider } from "./routing.ts";

const anthropicRequest: InvocationRequest = {
  agent: { id: "a", name: "A", model: "sonnet", systemPrompt: "p" },
  userMessage: "hello",
};

const openaiRequest: InvocationRequest = {
  agent: { id: "a", name: "A", model: "gpt-5.2", systemPrompt: "p" },
  userMessage: "hello",
};

type FakeRuntime = RuntimeProvider & {
  invokeRequests: InvocationRequest[];
  streamRequests: InvocationRequest[];
  healthChecks: number;
};

function completed(harnessSessionId: string | null): InvocationResult {
  return { status: "completed", finalText: "done", harnessSessionId, error: null };
}

function fakeRuntime(
  result: InvocationResult | ((request: InvocationRequest) => InvocationResult),
  events: StreamEvent[] = [],
  isHealthy = true,
): FakeRuntime {
  const invokeRequests: InvocationRequest[] = [];
  const streamRequests: InvocationRequest[] = [];
  let healthChecks = 0;
  return {
    name: "harness",
    invokeRequests,
    streamRequests,
    get healthChecks() {
      return healthChecks;
    },
    async invoke(request) {
      invokeRequests.push(request);
      return typeof result === "function" ? result(request) : result;
    },
    async *invokeStream(request) {
      streamRequests.push(request);
      yield* events;
    },
    async healthy() {
      healthChecks += 1;
      return isHealthy;
    },
  };
}

async function collect(events: AsyncIterable<StreamEvent>): Promise<StreamEvent[]> {
  const collected: StreamEvent[] = [];
  for await (const event of events) collected.push(event);
  return collected;
}

test("invoke sends both providers to one runtime and namespaces returned session ids", async () => {
  const runtime = fakeRuntime((request) =>
    completed(request.modelType === "openai" ? "o-session" : "a-session"),
  );
  const routing = new RoutingRuntimeProvider(runtime);

  expect(await routing.invoke(anthropicRequest)).toEqual(completed("anthropic:a-session"));
  expect(await routing.invoke(openaiRequest)).toEqual(completed("openai:o-session"));
  expect(runtime.invokeRequests).toEqual([
    { ...anthropicRequest, modelType: "anthropic" },
    { ...openaiRequest, modelType: "openai" },
  ]);
});

test("invoke strips matching namespaces and preserves only legacy Anthropic sessions", async () => {
  const runtime = fakeRuntime(completed(null));
  const routing = new RoutingRuntimeProvider(runtime);

  await routing.invoke({ ...anthropicRequest, resumeSessionId: "anthropic:previous-a" });
  await routing.invoke({ ...openaiRequest, resumeSessionId: "openai:previous-o" });
  await routing.invoke({ ...anthropicRequest, resumeSessionId: "legacy-session" });
  await routing.invoke({ ...openaiRequest, resumeSessionId: "legacy-session" });
  await routing.invoke({ ...anthropicRequest, resumeSessionId: "openai:other-session" });

  expect(runtime.invokeRequests).toEqual([
    { ...anthropicRequest, modelType: "anthropic", resumeSessionId: "previous-a" },
    { ...openaiRequest, modelType: "openai", resumeSessionId: "previous-o" },
    { ...anthropicRequest, modelType: "anthropic", resumeSessionId: "legacy-session" },
    { ...openaiRequest, modelType: "openai" },
    { ...anthropicRequest, modelType: "anthropic" },
  ]);
});

test("invoke avoids double-prefixing session ids", async () => {
  const runtime = fakeRuntime(completed("openai:next"));
  const routing = new RoutingRuntimeProvider(runtime);

  expect(await routing.invoke(openaiRequest)).toEqual(completed("openai:next"));
});

test("invokeStream selects a harness and namespaces only done events", async () => {
  const events: StreamEvent[] = [
    { type: "token", text: "do" },
    { type: "tool", name: "Read", summary: "file.ts" },
    { type: "done", finalText: "done", harnessSessionId: "stream-session" },
  ];
  const runtime = fakeRuntime(completed(null), events);
  const routing = new RoutingRuntimeProvider(runtime);

  expect(
    await collect(
      routing.invokeStream({ ...openaiRequest, resumeSessionId: "openai:previous-session" }),
    ),
  ).toEqual([
    { type: "token", text: "do" },
    { type: "tool", name: "Read", summary: "file.ts" },
    { type: "done", finalText: "done", harnessSessionId: "openai:stream-session" },
  ]);
  expect(runtime.streamRequests).toEqual([
    { ...openaiRequest, modelType: "openai", resumeSessionId: "previous-session" },
  ]);
});

test("healthy checks the shared harness once", async () => {
  const runtime = fakeRuntime(completed(null), [], false);
  const routing = new RoutingRuntimeProvider(runtime);

  expect(await routing.healthy()).toBe(false);
  expect(runtime.healthChecks).toBe(1);
});
