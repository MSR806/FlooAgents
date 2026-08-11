import { AgentConfig } from "@agent-platform/core/agent";
import { HarnessDefinition as HarnessDefinitionSchema } from "@agent-platform/core/harness";

export type AgentValues = ReturnType<typeof AgentConfig.parse>;
export type HarnessDefinition = ReturnType<typeof HarnessDefinitionSchema.parse>;

/** Validate the registry returned by the control plane. */
export function parseHarnessRegistry(value: unknown): HarnessDefinition[] {
  const parsed = HarnessDefinitionSchema.array().safeParse(value);
  if (!parsed.success) throw new Error("Invalid harness registry");
  return parsed.data;
}

export type GatewayTool = {
  name: string;
  description: string;
  inputSchema?: unknown;
  source: "custom" | "composio";
  toolkit: string;
  connected: boolean;
};

export type GatewayToolkit = {
  id: string;
  source: GatewayTool["source"];
  toolkit: string;
  connected: boolean;
  tools: GatewayTool[];
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

/** Validate and unwrap the concrete gateway tool catalog. */
export function parseGatewayTools(value: unknown): GatewayTool[] {
  if (!isRecord(value) || !Array.isArray(value.tools)) throw new Error("Invalid tool catalog");

  return value.tools.map((tool) => {
    if (
      !isRecord(tool) ||
      typeof tool.name !== "string" ||
      typeof tool.description !== "string" ||
      (tool.source !== "custom" && tool.source !== "composio") ||
      typeof tool.toolkit !== "string" ||
      typeof tool.connected !== "boolean"
    ) {
      throw new Error("Invalid tool catalog");
    }

    return {
      name: tool.name,
      description: tool.description,
      ...(tool.inputSchema === undefined ? {} : { inputSchema: tool.inputSchema }),
      source: tool.source,
      toolkit: tool.toolkit,
      connected: tool.connected,
    };
  });
}

/** Group exact gateway tools by provider and toolkit for toolkit-level selection. */
export function gatewayToolkits(tools: readonly GatewayTool[]): GatewayToolkit[] {
  const groups = new Map<string, GatewayToolkit>();
  for (const tool of tools) {
    const id = `${tool.source}:${tool.toolkit}`;
    const group = groups.get(id);
    if (group) {
      group.tools.push(tool);
      group.connected = group.connected && tool.connected;
    } else {
      groups.set(id, {
        id,
        source: tool.source,
        toolkit: tool.toolkit,
        connected: tool.connected,
        tools: [tool],
      });
    }
  }

  for (const group of groups.values()) group.tools.sort((a, b) => a.name.localeCompare(b.name));
  return [...groups.values()].sort((a, b) => a.toolkit.localeCompare(b.toolkit));
}

/** Select all current tools in a toolkit, or clear them when already fully selected. */
export function toggleGatewayToolkit(
  selected: readonly string[],
  toolkitTools: readonly string[],
): string[] {
  const next = new Set(selected);
  const allSelected = toolkitTools.length > 0 && toolkitTools.every((tool) => next.has(tool));
  for (const tool of toolkitTools) {
    if (allSelected) next.delete(tool);
    else next.add(tool);
  }
  return [...next];
}

/** Collapse exact gateway tool names to catalog toolkits, with a prefix fallback for unavailable tools. */
export function gatewayToolkitNames(
  tools: readonly string[] = [],
  catalog: readonly GatewayTool[] = [],
): string[] {
  const toolkitByTool = new Map(catalog.map((tool) => [tool.name, tool.toolkit]));
  return [...new Set(tools.map((tool) => toolkitByTool.get(tool) ?? (tool.split(".")[0] || tool)))];
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
