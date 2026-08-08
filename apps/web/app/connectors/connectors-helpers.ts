export type ComposioToolkit = {
  slug: string;
  name: string;
  description: string;
  logo?: string;
  toolsCount: number;
  connected: boolean;
  noAuth: boolean;
};

export type ComposioToolkitPage = {
  configured: boolean;
  items: ComposioToolkit[];
  nextCursor?: string;
};

export type ConnectionFeedback = { kind: "success" | "error"; message: string };

/** Validate a toolkit search response before rendering remote content. */
export function parseToolkitPage(value: unknown): ComposioToolkitPage {
  if (!isRecord(value) || typeof value.configured !== "boolean" || !Array.isArray(value.items)) {
    throw new Error("Invalid toolkit catalog");
  }
  if (value.nextCursor !== undefined && typeof value.nextCursor !== "string") {
    throw new Error("Invalid toolkit catalog");
  }

  const items = value.items.map((item) => {
    if (
      !isRecord(item) ||
      typeof item.slug !== "string" ||
      typeof item.name !== "string" ||
      typeof item.description !== "string" ||
      (item.logo !== undefined && typeof item.logo !== "string") ||
      typeof item.toolsCount !== "number" ||
      typeof item.connected !== "boolean" ||
      typeof item.noAuth !== "boolean"
    ) {
      throw new Error("Invalid toolkit catalog");
    }

    return {
      slug: item.slug,
      name: item.name,
      description: item.description,
      ...(item.logo === undefined ? {} : { logo: item.logo }),
      toolsCount: item.toolsCount,
      connected: item.connected,
      noAuth: item.noAuth,
    };
  });

  return {
    configured: value.configured,
    items,
    ...(value.nextCursor === undefined ? {} : { nextCursor: value.nextCursor }),
  };
}

/** Map search state to the paginated toolkit endpoint. */
export function toolkitSearchUrl(apiBase: string, query: string, cursor?: string): string {
  const params = new URLSearchParams();
  if (query) params.set("query", query);
  if (cursor) params.set("cursor", cursor);
  const search = params.toString();
  return `${apiBase}/composio/toolkits${search ? `?${search}` : ""}`;
}

export function parseConnectionFeedback(search: string): ConnectionFeedback | null {
  const params = new URLSearchParams(search);
  const connected = params.get("connected");
  const status = params.get("status");
  if (!connected && !status) return null;
  if (connected !== null && !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(connected)) return null;
  if (status !== null && !["success", "connected", "error"].includes(status)) return null;

  const failed = status === "error";
  const target = connected ?? "Composio toolkit";
  return failed
    ? { kind: "error", message: `Could not connect ${target} (${status}).` }
    : { kind: "success", message: `Connected ${target}.` };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
