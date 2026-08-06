import { expect, test } from "bun:test";
import { MODEL_CATALOG, providerFor, resolveCodexModel } from "./model.ts";

test("MODEL_CATALOG declares supported models and providers", () => {
  expect(MODEL_CATALOG).toEqual([
    { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", provider: "anthropic" },
    { id: "claude-opus-4-8", label: "Claude Opus 4.8", provider: "anthropic" },
    { id: "gpt-5.5", label: "GPT-5.5", provider: "openai" },
    {
      id: "gpt-5.4-fast",
      label: "GPT-5.4 Fast",
      provider: "openai",
      codexModel: "gpt-5.4",
      codexServiceTier: "fast",
    },
    { id: "gpt-5.2", label: "GPT-5.2", provider: "openai" },
    { id: "gpt-5.2-codex", label: "GPT-5.2 Codex", provider: "openai" },
  ]);
  expect(MODEL_CATALOG.map(({ id }) => providerFor(id))).toEqual(
    MODEL_CATALOG.map(({ provider }) => provider),
  );
});

test("resolveCodexModel unpacks a display-only variant into its real model and service tier", () => {
  expect(resolveCodexModel("gpt-5.4-fast")).toEqual({ model: "gpt-5.4", serviceTier: "fast" });
});

test("resolveCodexModel passes through a plain catalog id unchanged", () => {
  expect(resolveCodexModel("gpt-5.2")).toEqual({ model: "gpt-5.2", serviceTier: undefined });
});

test("providerFor preserves legacy Claude aliases and the Anthropic fallback", () => {
  expect(["sonnet", "opus", "haiku", "claude-future", "custom-model"].map(providerFor)).toEqual([
    "anthropic",
    "anthropic",
    "anthropic",
    "anthropic",
    "anthropic",
  ]);
});

test("providerFor recognizes uncatalogued OpenAI model families", () => {
  expect(
    ["gpt-future", "o9-reasoning", "codex-mini-latest", "openai/custom"].map(providerFor),
  ).toEqual(["openai", "openai", "openai", "openai"]);
});

test("providerFor rejects legacy GPT-OSS models while open-source support is disabled", () => {
  expect(() => providerFor("gpt-oss-120b")).toThrow("Open-source model support is disabled");
});
