import { AgentConfig, ModelInfo as ModelInfoSchema } from "@gilly/core";

export type AgentValues = ReturnType<typeof AgentConfig.parse>;
export type ModelInfo = ReturnType<typeof ModelInfoSchema.parse>;

export type GatewayTool = {
  name: string;
  description: string;
  inputSchema?: unknown;
  source: "custom" | "composio";
  toolkit: string;
  connected: boolean;
};

export type ModelOptionGroup = {
  label: string;
  options: { value: string; label: string }[];
};

export type GatewayToolGroup = {
  label: string;
  options: { value: string; description?: string }[];
};

const PROVIDERS = [
  { provider: "anthropic", label: "Anthropic" },
  { provider: "openai", label: "OpenAI" },
] as const;

/** Validate the model catalog returned by the control plane. */
export function parseModelCatalog(value: unknown): ModelInfo[] {
  const parsed = ModelInfoSchema.array().safeParse(value);
  if (!parsed.success) throw new Error("Invalid model catalog");
  return parsed.data;
}

/** Group catalog models in picker order, preserving an unlisted current model as a safe fallback. */
export function modelOptionGroups(models: readonly ModelInfo[], currentModel: string) {
  const groups: ModelOptionGroup[] = PROVIDERS.map(({ provider, label }) => ({
    label,
    options: models
      .filter((model) => model.provider === provider)
      .map((model) => ({ value: model.id, label: model.label })),
  })).filter((group) => group.options.length > 0);
  const currentIsCatalogued = models.some((model) => model.id === currentModel);

  if (currentModel && !currentIsCatalogued) {
    groups.unshift({
      label: "Current / legacy",
      options: [{ value: currentModel, label: `${currentModel} (current model)` }],
    });
  }

  return { groups, currentIsCatalogued };
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

/** Group concrete tools by toolkit and keep selected tools missing from the current catalog. */
export function gatewayToolGroups(
  tools: readonly GatewayTool[],
  selected: readonly string[],
): GatewayToolGroup[] {
  const groups = new Map<string, GatewayToolGroup["options"]>();

  for (const tool of tools) {
    const options = groups.get(tool.toolkit) ?? [];
    options.push({
      value: tool.name,
      description: tool.connected ? tool.description : `${tool.description} (not connected)`,
    });
    groups.set(tool.toolkit, options);
  }

  const available = new Set(tools.map((tool) => tool.name));
  const unavailable = [...new Set(selected)]
    .filter((name) => !available.has(name))
    .map((value) => ({ value, description: "Unavailable in the current catalog" }));

  return [
    ...[...groups.entries()].map(([label, options]) => ({ label, options })),
    ...(unavailable.length ? [{ label: "Unavailable", options: unavailable }] : []),
  ];
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
