import { AgentConfig } from "@floo/core/agent";
import { HarnessDefinition as HarnessDefinitionSchema } from "@floo/core/harness";

export type AgentValues = ReturnType<typeof AgentConfig.parse>;
export type HarnessDefinition = ReturnType<typeof HarnessDefinitionSchema.parse>;

/** Validate the registry returned by the control plane. */
export function parseHarnessRegistry(value: unknown): HarnessDefinition[] {
  const parsed = HarnessDefinitionSchema.array().safeParse(value);
  if (!parsed.success) throw new Error("Invalid harness registry");
  return parsed.data;
}

export type GatewayToolkit = {
  name: string;
  source: "custom" | "composio";
  connected: boolean;
};

/** Resolve the selected enabled harness and whether its current model is offered. */
export function harnessSelection(
  harnesses: readonly HarnessDefinition[],
  harness: AgentValues["harness"],
) {
  const enabled = harnesses.filter((candidate) => candidate.enabled);
  const selected = enabled.find((candidate) => candidate.id === harness.id);
  const modelValid = selected?.models.some((model) => model.id === harness.config.model) ?? false;
  return { enabled, selected, modelValid, valid: !!selected && modelValid };
}

/** Validate and unwrap the gateway toolkit catalog. */
export function parseGatewayToolkits(value: unknown): GatewayToolkit[] {
  if (!isRecord(value) || !Array.isArray(value.toolkits))
    throw new Error("Invalid toolkit catalog");

  return value.toolkits.map((toolkit) => {
    if (
      !isRecord(toolkit) ||
      typeof toolkit.name !== "string" ||
      (toolkit.source !== "custom" && toolkit.source !== "composio") ||
      typeof toolkit.connected !== "boolean"
    ) {
      throw new Error("Invalid toolkit catalog");
    }

    return {
      name: toolkit.name,
      source: toolkit.source,
      connected: toolkit.connected,
    };
  });
}

/** Select a whole toolkit, upgrading any existing exact entries to one terminal wildcard. */
export function toggleGatewayToolkit(selected: readonly string[], toolkit: string): string[] {
  const pattern = `${toolkit}.*`;
  const next = selected.filter((tool) => tool !== pattern && !tool.startsWith(`${toolkit}.`));
  return selected.includes(pattern) ? next : [...next, pattern];
}

/** Collapse gateway tool names and patterns to toolkit names. */
export function gatewayToolkitNames(tools: readonly string[] = []): string[] {
  return [...new Set(tools.map((tool) => tool.split(".")[0] || tool))];
}

/** Validate the successful create/update response before reflecting server-owned values in the UI. */
export function parseAgentValues(value: unknown): AgentValues {
  const parsed = AgentConfig.safeParse(value);
  if (!parsed.success) throw new Error("Server returned an invalid agent");
  return parsed.data;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
