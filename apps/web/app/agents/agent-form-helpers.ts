import { AgentConfig, ModelInfo as ModelInfoSchema } from "@gilly/core";

export type AgentValues = ReturnType<typeof AgentConfig.parse>;
export type ModelInfo = ReturnType<typeof ModelInfoSchema.parse>;

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

/** Validate the successful create/update response before reflecting server-owned values in the UI. */
export function parseAgentValues(value: unknown): AgentValues {
  const parsed = AgentConfig.safeParse(value);
  if (!parsed.success) throw new Error("Server returned an invalid agent");
  return parsed.data;
}
