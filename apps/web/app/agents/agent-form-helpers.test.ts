import { expect, test } from "bun:test";
import {
  gatewayToolkitNames,
  harnessSelection,
  parseAgentValues,
  parseGatewayToolkits,
  parseHarnessRegistry,
  toggleGatewayToolkit,
  unavailableGatewayTools,
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

test("parseGatewayToolkits validates and unwraps the toolkit catalog", () => {
  const toolkits = [
    {
      name: "github",
      source: "composio" as const,
      connected: true,
    },
  ];

  expect(parseGatewayToolkits({ toolkits })).toEqual(toolkits);
  expect(() => parseGatewayToolkits({ toolkits: [{ ...toolkits[0], connected: "yes" }] })).toThrow(
    "Invalid toolkit catalog",
  );
});

test("toggleGatewayToolkit upgrades exact entries to one wildcard and clears it", () => {
  expect(toggleGatewayToolkit(["github.create_issue", "legacy.tool"], "github")).toEqual([
    "legacy.tool",
    "github.*",
  ]);
  expect(toggleGatewayToolkit(["legacy.tool", "github.*"], "github")).toEqual(["legacy.tool"]);
});

test("gatewayToolkitNames shows one entry per exact-tool prefix", () => {
  expect(gatewayToolkitNames(["echo.*", "gmail.send_email", "gmail.*", "legacy_tool"])).toEqual([
    "echo",
    "gmail",
    "legacy_tool",
  ]);
});

test("unavailableGatewayTools identifies catalog-absent selections", () => {
  expect(
    unavailableGatewayTools(
      ["agent_builder.list_agents", "legacy.tool", "gmail.*", "legacy.tool"],
      new Set(["gmail"]),
    ),
  ).toEqual(["agent_builder.list_agents", "legacy.tool"]);
});
