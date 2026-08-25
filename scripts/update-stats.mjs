// Fetches network stats from the VIA scan API and injects them into
// profile/README.md between <!-- STATS:START --> and <!-- STATS:END -->.
// Runs server-side in GitHub Actions, so no CORS involved.

import { readFileSync, writeFileSync } from "node:fs";

const BASE = process.env.SCAN_API_BASE ?? "https://scansite.druuu.net/api/v1";
const CHAIN_TYPE = process.env.CHAIN_TYPE ?? "testnet";
const README = new URL("../profile/README.md", import.meta.url).pathname;

async function getStat(name, hours) {
  const url = `${BASE}/stats/${name}?hours=${hours}&chainType=${CHAIN_TYPE}`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    // Log raw payload so field names can be verified/adjusted from the Actions log
    console.log(`--- ${name} (${hours}h) ---\n${JSON.stringify(json, null, 2)}`);
    if (!json?.status) return null; // {status:false, message:"No data"} on empty window
    return json.data ?? null;
  } catch (err) {
    console.error(`Failed to fetch ${name}:`, err.message);
    return null;
  }
}

// Pull a number out of data that might be a bare number, or an object with a
// likely-named field. Adjust the candidate keys once you've seen the real payload.
function num(data, keys) {
  if (data == null) return null;
  if (typeof data === "number") return data;
  if (typeof data === "string" && !isNaN(+data)) return +data;
  for (const k of keys) {
    const v = data[k];
    if (v != null && !isNaN(+v)) return +v;
  }
  return null;
}

const fmt = (n) => (n == null ? "—" : n.toLocaleString("en-US"));
const fmtSecs = (n) => (n == null ? "—" : `${Math.round(n)}s`);

const [vol24, vol30d, delivery, chains] = await Promise.all([
  getStat("volume", 24),
  getStat("volume", 720),
  getStat("delivery", 720),
  getStat("chains", 720),
]);

const messages24h = num(vol24, ["total_messages", "count", "total"]);
const messages30d = num(vol30d, ["total_messages", "count", "total"]);
const avgDelivery = num(delivery, ["avg_delivery_time", "average", "avg"]);
const activeChains = Array.isArray(chains)
  ? chains.length
  : num(chains, ["count", "chains", "total"]);

const now = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";

const block = `
| 📨 Messages (24h) | 📈 Messages (30d) | ⚡ Avg delivery | ⛓️ Active chains |
|:---:|:---:|:---:|:---:|
| **${fmt(messages24h)}** | **${fmt(messages30d)}** | **${fmtSecs(avgDelivery)}** | **${fmt(activeChains)}** |

<sub>Live from [VIA Scan](https://scan.vialabs.tech) · Last updated: ${now}</sub>
`;

const md = readFileSync(README, "utf8");
const updated = md.replace(
  /<!-- STATS:START -->[\s\S]*<!-- STATS:END -->/,
  `<!-- STATS:START -->\n${block}\n<!-- STATS:END -->`
);

if (updated === md) {
  console.log("No changes to README (markers missing or identical content).");
} else {
  writeFileSync(README, updated);
  console.log("README stats updated.");
}