// Offline transports: replay recorded RPC/HTTP responses from a fixture
// file. Used by tests and `npm run scan:offline` so the entire pipeline is
// exercisable with zero network — the same code path CI runs live.

/** RPC transport: looks up responses by method + canonical params key. */
export function makeFixtureTransport(fixtures) {
  return async (endpoint, batch) => {
    return batch.map((req) => {
      if (req.method === "eth_chainId") return { id: req.id, result: fixtures.chainId ?? "0x2105" };
      const key = rpcKey(req.method, req.params);
      const hit = fixtures.rpc?.[key];
      if (hit === undefined) return { id: req.id, error: { message: `no fixture for ${key}` } };
      if (hit && typeof hit === "object" && hit.error) return { id: req.id, error: { message: hit.error } };
      return { id: req.id, result: hit };
    });
  };
}

/** HTTP fetcher: looks up JSON bodies by URL. */
export function makeFixtureFetcher(fixtures) {
  return async (url) => {
    const hit = fixtures.http?.[url];
    if (hit === undefined) {
      return { ok: false, status: 404, json: async () => ({}) };
    }
    return { ok: true, status: 200, json: async () => hit };
  };
}

export function rpcKey(method, params) {
  if (method === "eth_call") {
    const { to, data } = params[0] ?? {};
    return `eth_call:${(to ?? "").toLowerCase()}:${data ?? ""}`;
  }
  if (method === "eth_getCode") return `eth_getCode:${(params[0] ?? "").toLowerCase()}`;
  if (method === "eth_getStorageAt") return `eth_getStorageAt:${(params[0] ?? "").toLowerCase()}:${params[1]}`;
  return `${method}:${JSON.stringify(params)}`;
}
