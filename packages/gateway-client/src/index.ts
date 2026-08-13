/**
 * Script-side client for the Tool Gateway. Agent-written scripts run inside the sandbox and
 * import this to reach the gateway over HTTP, authenticated by the run-scoped token in the env.
 *
 * Wire contract (matched by the Wave 3 gateway server):
 *   POST ${url}/catalog  { query? }        -> { tools: [{ name, description, inputSchema? }] }
 *   POST ${url}/invoke   { tool, input }    -> the tool result (any JSON)
 *   Either route may answer with { error } (e.g. "tool_not_found", "not_connected") — we throw it.
 */

export type CatalogEntry = { name: string; description: string; inputSchema?: unknown };

type FetchFn = typeof fetch;

function env(): { url: string; token: string } {
  const url = process.env.TOOL_GATEWAY_URL;
  const token = process.env.TOOL_GATEWAY_TOKEN;
  if (!url) throw new Error("TOOL_GATEWAY_URL is not set");
  if (!token) throw new Error("TOOL_GATEWAY_TOKEN is not set");
  return { url, token };
}

async function post(path: string, body: unknown, fetchFn: FetchFn): Promise<unknown> {
  const { url, token } = env();
  const res = await fetchFn(`${url}${path}`, {
    method: "POST",
    // We are the script lane: results are processed here in the sandbox, not sent to the model,
    // so opt out of the gateway's direct-lane result-size cap.
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      "x-tool-gateway-lane": "script",
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { error?: string } | unknown;
  const error = (data as { error?: string })?.error;
  if (!res.ok || error) {
    const detail = data && typeof data === "object" ? JSON.stringify(data) : undefined;
    throw new Error(detail ?? error ?? `gateway ${res.status}`);
  }
  return data;
}

/** Search the tools this caller may use. `fetchFn` is injectable only for testing. */
export async function catalog(query?: string, fetchFn: FetchFn = fetch): Promise<CatalogEntry[]> {
  const data = (await post("/catalog", { query }, fetchFn)) as { tools: CatalogEntry[] };
  return data.tools;
}

/** Run one tool and return its result. `fetchFn` is injectable only for testing. */
export async function invoke(
  tool: string,
  input: unknown,
  fetchFn: FetchFn = fetch,
): Promise<unknown> {
  return post("/invoke", { tool, input }, fetchFn);
}
