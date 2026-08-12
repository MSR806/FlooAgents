const GATEWAY_TIMEOUT_MS = 30_000;

export type GatewayPostResult = { ok: boolean; data: unknown };

/** POST authenticated JSON to the tool gateway with a bounded request lifetime. */
export async function gatewayPost(
  url: string,
  token: string,
  path: string,
  body: unknown,
  fetchFn = fetch,
): Promise<GatewayPostResult> {
  try {
    const response = await fetchFn(`${url}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
    });
    return { ok: response.ok, data: await response.json() };
  } catch (error) {
    return {
      ok: false,
      data: { error: error instanceof Error ? error.message : String(error) },
    };
  }
}
