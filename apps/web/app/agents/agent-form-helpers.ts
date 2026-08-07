import { AgentConfig, HarnessDefinition as HarnessDefinitionSchema } from "@gilly/core";

export type AgentValues = ReturnType<typeof AgentConfig.parse>;
export type HarnessDefinition = ReturnType<typeof HarnessDefinitionSchema.parse>;

/** Validate the registry returned by the control plane. */
export function parseHarnessRegistry(value: unknown): HarnessDefinition[] {
  const parsed = HarnessDefinitionSchema.array().safeParse(value);
  if (!parsed.success) throw new Error("Invalid harness registry");
  return parsed.data;
}

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

/** Validate the successful create/update response before reflecting server-owned values in the UI. */
export function parseAgentValues(value: unknown): AgentValues {
  const parsed = AgentConfig.safeParse(value);
  if (!parsed.success) throw new Error("Server returned an invalid agent");
  return parsed.data;
}
