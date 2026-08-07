import { expect, test } from "bun:test";
import { harnessSelection, parseAgentValues, parseHarnessRegistry } from "./agent-form-helpers";

const registry = [
  {
    id: "claude",
    name: "Claude",
    enabled: true,
    models: [{ id: "sonnet", name: "Sonnet" }],
  },
  {
    id: "codex",
    name: "Codex",
    enabled: false,
    models: [{ id: "gpt", name: "GPT" }],
  },
];

test("parseHarnessRegistry validates registry entries", () => {
  expect(parseHarnessRegistry(registry)).toEqual(registry);
  expect(() => parseHarnessRegistry([{ id: "claude" }])).toThrow("Invalid harness registry");
});

test("harnessSelection exposes only enabled harnesses and requires an offered model", () => {
  expect(harnessSelection(registry, { id: "claude", config: { model: "sonnet" } })).toEqual({
    enabled: [registry[0]],
    selected: registry[0],
    modelValid: true,
    valid: true,
  });
  expect(harnessSelection(registry, { id: "codex", config: { model: "gpt" } }).valid).toBe(false);
  expect(harnessSelection(registry, { id: "claude", config: { model: "legacy" } }).valid).toBe(
    false,
  );
});

test("parseAgentValues accepts nested harness config and rejects flat model responses", () => {
  const agent = {
    id: "helper",
    name: "Server name",
    harness: { id: "claude", config: { model: "sonnet" } },
    systemPrompt: "Help.",
  };
  expect(parseAgentValues(agent)).toEqual(agent);
  expect(() => parseAgentValues({ ...agent, harness: undefined, model: "sonnet" })).toThrow(
    "Server returned an invalid agent",
  );
});
