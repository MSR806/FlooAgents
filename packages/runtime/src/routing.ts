import { type ModelProvider, providerFor } from "@gilly/core";
import type { InvocationRequest, InvocationResult, StreamEvent } from "@gilly/harness-protocol";
import type { RuntimeProvider } from "./provider.ts";

type HarnessProvider = ModelProvider;
const providers: readonly HarnessProvider[] = ["anthropic", "openai"];

function namespaceSessionId(provider: HarnessProvider, sessionId: string | null): string | null {
  if (sessionId === null || sessionId.startsWith(`${provider}:`)) return sessionId;
  return `${provider}:${sessionId}`;
}

function requestForProvider(req: InvocationRequest, provider: HarnessProvider): InvocationRequest {
  const { resumeSessionId, ...freshRequest } = req;
  const providerRequest = { ...freshRequest, harnessType: provider };
  if (resumeSessionId === undefined) return providerRequest;

  const matchingPrefix = `${provider}:`;
  if (resumeSessionId.startsWith(matchingPrefix)) {
    return { ...providerRequest, resumeSessionId: resumeSessionId.slice(matchingPrefix.length) };
  }

  const isNamespaced = providers.some((candidate) => resumeSessionId.startsWith(`${candidate}:`));
  if (!isNamespaced && provider === "anthropic") return { ...providerRequest, resumeSessionId };
  return providerRequest;
}

/** Selects the model harness and keeps provider-specific session ids isolated. */
export class RoutingRuntimeProvider implements RuntimeProvider {
  readonly name = "routing";

  constructor(private readonly runtime: RuntimeProvider) {}

  private provider(model: string): HarnessProvider {
    return providerFor(model) === "anthropic" ? "anthropic" : "openai";
  }

  async invoke(req: InvocationRequest): Promise<InvocationResult> {
    const provider = this.provider(req.agent.model);
    const result = await this.runtime.invoke(requestForProvider(req, provider));
    return {
      ...result,
      harnessSessionId: namespaceSessionId(provider, result.harnessSessionId),
    };
  }

  async *invokeStream(req: InvocationRequest): AsyncIterable<StreamEvent> {
    const provider = this.provider(req.agent.model);
    for await (const event of this.runtime.invokeStream(requestForProvider(req, provider))) {
      if (event.type === "done") {
        yield {
          ...event,
          harnessSessionId: namespaceSessionId(provider, event.harnessSessionId),
        };
      } else {
        yield event;
      }
    }
  }

  async healthy(): Promise<boolean> {
    return this.runtime.healthy();
  }
}
