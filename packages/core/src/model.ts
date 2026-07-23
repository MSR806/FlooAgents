import { z } from "zod";

export const ModelProvider = z.enum(["anthropic", "openai"]);
export type ModelProvider = z.infer<typeof ModelProvider>;

export const ModelInfo = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  provider: ModelProvider,
});
export type ModelInfo = z.infer<typeof ModelInfo>;

export const MODEL_CATALOG = [
  { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", provider: "anthropic" },
  { id: "claude-opus-4-8", label: "Claude Opus 4.8", provider: "anthropic" },
  { id: "gpt-5.5", label: "GPT-5.5", provider: "openai" },
  { id: "gpt-5.4-fast", label: "GPT-5.4 Fast", provider: "openai" },
  { id: "gpt-5.2", label: "GPT-5.2", provider: "openai" },
  { id: "gpt-5.2-codex", label: "GPT-5.2 Codex", provider: "openai" },
] as const satisfies readonly ModelInfo[];

/** Resolve catalog models and recognizable provider model ids, preserving Anthropic by default. */
export function providerFor(model: string): ModelProvider {
  const catalogModel = MODEL_CATALOG.find(({ id }) => id === model);
  if (catalogModel) return catalogModel.provider;

  const normalized = model.toLowerCase();
  if (normalized.startsWith("gpt-oss")) {
    throw new Error(`Open-source model support is disabled: ${model}`);
  }
  if (
    normalized.startsWith("gpt-") ||
    normalized.startsWith("openai/") ||
    normalized.startsWith("codex-") ||
    /^o\d(?:-|$)/.test(normalized)
  ) {
    return "openai";
  }
  return "anthropic";
}
