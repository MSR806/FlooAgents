import { expect, test } from "bun:test";
import { modelOptionGroups, parseAgentValues, parseModelCatalog } from "./agent-form-helpers";

test("parseModelCatalog validates catalog entries", () => {
  expect(parseModelCatalog([{ id: "gpt", label: "GPT", provider: "openai" }])).toEqual([
    { id: "gpt", label: "GPT", provider: "openai" },
  ]);
  expect(() => parseModelCatalog([{ id: "gpt", provider: "openai" }])).toThrow(
    "Invalid model catalog",
  );
});

test("modelOptionGroups uses provider order and preserves an unlisted current model", () => {
  const result = modelOptionGroups(
    [
      { id: "claude", label: "Claude", provider: "anthropic" },
      { id: "gpt", label: "GPT", provider: "openai" },
    ],
    "retired-model",
  );

  expect(result).toEqual({
    currentIsCatalogued: false,
    groups: [
      {
        label: "Current / legacy",
        options: [{ value: "retired-model", label: "retired-model (current model)" }],
      },
      { label: "Anthropic", options: [{ value: "claude", label: "Claude" }] },
      { label: "OpenAI", options: [{ value: "gpt", label: "GPT" }] },
    ],
  });
});

test("modelOptionGroups does not duplicate a catalogued current model", () => {
  expect(
    modelOptionGroups([{ id: "claude", label: "Claude", provider: "anthropic" }], "claude"),
  ).toEqual({
    currentIsCatalogued: true,
    groups: [{ label: "Anthropic", options: [{ value: "claude", label: "Claude" }] }],
  });
});

test("parseAgentValues returns the server agent and rejects malformed responses", () => {
  const agent = {
    id: "helper",
    name: "Server name",
    model: "claude",
    systemPrompt: "Help.",
    skills: ["research"],
  };

  expect(parseAgentValues(agent)).toEqual(agent);
  expect(() => parseAgentValues({ ...agent, model: undefined })).toThrow(
    "Server returned an invalid agent",
  );
});
