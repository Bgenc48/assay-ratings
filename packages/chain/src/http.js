// GET-JSON helper with timeout, used for the free public APIs (DexScreener,
// Blockscout). Injectable for tests/offline mode.
const TIMEOUT_MS = 10_000;

export async function getJson(url, { fetcher = fetch } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetcher(url, {
      headers: { accept: "application/json", "user-agent": "assay-scanner/0.1 (+https://assayratings.com)" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}
