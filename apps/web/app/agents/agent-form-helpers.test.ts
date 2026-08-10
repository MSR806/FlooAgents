import { expect, test } from "bun:test";
import {
  gatewayToolkitNames,
  gatewayToolkits,
  harnessSelection,
  parseAgentValues,
  parseGatewayTools,
  parseHarnessRegistry,
  toggleGatewayToolkit,
} from "./agent-form-helpers";

const registry = [
  {
    id: "claude",
    name: "Claude",
    image: "/harnesses/claude.svg",
    enabled: true,
    models: [{ id: "sonnet", name: "Sonnet" }],
  },
  {
    id: "codex",
    name: "Codex",
    image: "/harnesses/codex.svg",
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
    skills: ["research"],
    gatewayTools: ["GITHUB_CREATE_ISSUE"],
  };
  expect(parseAgentValues(agent)).toEqual(agent);
  expect(() => parseAgentValues({ ...agent, harness: undefined, model: "sonnet" })).toThrow(
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

test("gatewayToolkits groups exact tools by source and toolkit", () => {
  expect(
    gatewayToolkits([
      {
        name: "github.create_issue",
        description: "Create an issue",
        source: "composio",
        toolkit: "github",
        connected: true,
      },
      {
        name: "github.get_issue",
        description: "Get an issue",
        source: "composio",
        toolkit: "github",
        connected: true,
      },
      {
        name: "internal.search",
        description: "Search records",
        source: "custom",
        toolkit: "internal",
        connected: false,
      },
    ]),
  ).toEqual([
    {
      id: "composio:github",
      source: "composio",
      toolkit: "github",
      connected: true,
      tools: [
        {
          name: "github.create_issue",
          description: "Create an issue",
          source: "composio",
          toolkit: "github",
          connected: true,
        },
        {
          name: "github.get_issue",
          description: "Get an issue",
          source: "composio",
          toolkit: "github",
          connected: true,
        },
      ],
    },
    {
      id: "custom:internal",
      source: "custom",
      toolkit: "internal",
      connected: false,
      tools: [
        {
          name: "internal.search",
          description: "Search records",
          source: "custom",
          toolkit: "internal",
          connected: false,
        },
      ],
    },
  ]);
});

test("toggleGatewayToolkit selects partial toolkits and clears complete ones without losing legacy values", () => {
  expect(
    toggleGatewayToolkit(
      ["github.create_issue", "legacy.tool"],
      ["github.create_issue", "github.get_issue"],
    ),
  ).toEqual(["github.create_issue", "legacy.tool", "github.get_issue"]);
  expect(
    toggleGatewayToolkit(
      ["github.create_issue", "legacy.tool", "github.get_issue"],
      ["github.create_issue", "github.get_issue"],
    ),
  ).toEqual(["legacy.tool"]);
});

test("gatewayToolkitNames shows one entry per exact-tool prefix", () => {
  expect(
    gatewayToolkitNames(["echo.ping", "gmail.send_email", "gmail.create_draft", "legacy_tool"]),
  ).toEqual(["echo", "gmail", "legacy_tool"]);
});

test("gatewayToolkitNames uses catalog metadata for underscore-formatted tools", () => {
  const catalog = [
    {
      name: "GITHUB_CREATE_ISSUE",
      description: "Create an issue",
      source: "composio" as const,
      toolkit: "github",
      connected: true,
    },
    {
      name: "GITHUB_GET_ISSUE",
      description: "Get an issue",
      source: "composio" as const,
      toolkit: "github",
      connected: true,
    },
  ];

  expect(gatewayToolkitNames(["GITHUB_CREATE_ISSUE", "GITHUB_GET_ISSUE"], catalog)).toEqual([
    "github",
  ]);
});
