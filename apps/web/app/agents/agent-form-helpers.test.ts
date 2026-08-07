import { expect, test } from "bun:test";
import {
  gatewayToolGroups,
  modelOptionGroups,
  parseAgentValues,
  parseGatewayTools,
  parseModelCatalog,
} from "./agent-form-helpers";

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
    gatewayTools: ["GITHUB_CREATE_ISSUE"],
  };

  expect(parseAgentValues(agent)).toEqual(agent);
  expect(() => parseAgentValues({ ...agent, model: undefined })).toThrow(
    "Server returned an invalid agent",
  );
});

test("parseGatewayTools validates and unwraps the tool catalog", () => {
  const tools = [
    {
      name: "GITHUB_CREATE_ISSUE",
      description: "Create an issue",
      source: "composio" as const,
      toolkit: "github",
      connected: true,
    },
  ];

  expect(parseGatewayTools({ tools })).toEqual(tools);
  expect(() => parseGatewayTools({ tools: [{ ...tools[0], connected: "yes" }] })).toThrow(
    "Invalid tool catalog",
  );
});

test("gatewayToolGroups groups by toolkit and preserves selected unavailable tools", () => {
  expect(
    gatewayToolGroups(
      [
        {
          name: "GITHUB_CREATE_ISSUE",
          description: "Create an issue",
          source: "composio",
          toolkit: "github",
          connected: true,
        },
        {
          name: "custom_search",
          description: "Search records",
          source: "custom",
          toolkit: "internal",
          connected: false,
        },
      ],
      ["GITHUB_CREATE_ISSUE", "retired_tool"],
    ),
  ).toEqual([
    {
      label: "github",
      options: [{ value: "GITHUB_CREATE_ISSUE", description: "Create an issue" }],
    },
    {
      label: "internal",
      options: [{ value: "custom_search", description: "Search records (not connected)" }],
    },
    {
      label: "Unavailable",
      options: [{ value: "retired_tool", description: "Unavailable in the current catalog" }],
    },
  ]);
});
