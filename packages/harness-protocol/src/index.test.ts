import { expect, test } from "bun:test";
import { InvocationRequest, InvocationResult } from "./index.ts";

test("InvocationRequest round-trips a minimal payload", () => {
  const req = {
    agent: { id: "a", name: "A", model: "claude-sonnet-4-5", systemPrompt: "do x" },
    userMessage: "hello",
  };
  expect(InvocationRequest.parse(req)).toMatchObject(req);
});

test("InvocationRequest carries inline skills", () => {
  const req = {
    harnessType: "openai" as const,
    agent: {
      id: "release-bot",
      name: "Release Bot",
      model: "gpt-5.2",
      systemPrompt: "ship it",
      skills: ["cut-release"],
    },
    userMessage: "cut 1.4.0",
    skills: [{ name: "cut-release", files: [{ path: "SKILL.md", contents: "# go" }] }],
  };
  expect(InvocationRequest.parse(req)).toMatchObject(req);
});

test("InvocationRequest rejects unknown model types", () => {
  const req = {
    harnessType: "unknown",
    agent: { id: "a", name: "A", model: "model", systemPrompt: "do x" },
    userMessage: "hello",
  };
  expect(InvocationRequest.safeParse(req).success).toBe(false);
});

test("InvocationResult requires nullable fields to be present", () => {
  const ok = InvocationResult.safeParse({
    status: "completed",
    finalText: "done",
    harnessSessionId: "s1",
    error: null,
  });
  expect(ok.success).toBe(true);
});
