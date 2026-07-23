export type AgentValues = {
  id: string;
  name: string;
  model: string;
  systemPrompt: string;
  tools?: string[];
  skills?: string[];
  connectors?: string[];
};

export type ModelInfo = {
  id: string;
  label: string;
  provider: "anthropic" | "openai";
};

export type ModelOptionGroup = {
  label: string;
  options: { value: string; label: string }[];
};

const PROVIDERS = [
  { provider: "anthropic", label: "Anthropic" },
  { provider: "openai", label: "OpenAI" },
] as const;

/** Validate the model catalog returned by the control plane. */
export function parseModelCatalog(value: unknown): ModelInfo[] {
  if (!Array.isArray(value)) throw new Error("Invalid model catalog");

  return value.map((item) => {
    if (!item || typeof item !== "object") throw new Error("Invalid model catalog");
    const record = item as Record<string, unknown>;
    if (
      typeof record.id !== "string" ||
      !record.id ||
      typeof record.label !== "string" ||
      !record.label ||
      !PROVIDERS.some(({ provider }) => provider === record.provider)
    ) {
      throw new Error("Invalid model catalog");
    }
    return record as ModelInfo;
  });
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

/** Validate the successful create/update response before reflecting server-owned values in the UI. */
export function parseAgentValues(value: unknown): AgentValues {
  if (!value || typeof value !== "object") throw new Error("Server returned an invalid agent");
  const record = value as Record<string, unknown>;
  for (const key of ["id", "name", "model", "systemPrompt"] as const) {
    if (typeof record[key] !== "string" || !record[key]) {
      throw new Error("Server returned an invalid agent");
    }
  }

  const optionalArrays = ["tools", "skills", "connectors"] as const;
  for (const key of optionalArrays) {
    if (
      record[key] !== undefined &&
      (!Array.isArray(record[key]) || !record[key].every((item) => typeof item === "string"))
    ) {
      throw new Error("Server returned an invalid agent");
    }
  }

  return value as AgentValues;
}
