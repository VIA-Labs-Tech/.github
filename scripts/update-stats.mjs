// Fetches network stats from the VIA scan API and renders a branded SVG card
// at profile/assets/stats.svg, embedded in the org README as an image.
// Palette matches vialabs.tech / the bridge app: #0F1117 bg, #00E5E5 teal,
// #1E2029 borders, emerald for success.

import { writeFileSync, mkdirSync } from "node:fs";

const BASE = process.env.SCAN_API_BASE ?? "https://scansite.druuu.net/api/v1";
const CHAIN_TYPE = process.env.CHAIN_TYPE ?? "testnet";
const OUT = new URL("../profile/assets/stats.svg", import.meta.url).pathname;

async function getStat(name, hours) {
  const url = `${BASE}/stats/${name}?hours=${hours}&chainType=${CHAIN_TYPE}`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    if (!json?.status) return null;
    return json.data ?? null;
  } catch (err) {
    console.error(`Failed to fetch ${name}:`, err.message);
    return null;
  }
}

const [vol24, vol30d, delivery, chains] = await Promise.all([
  getStat("volume", 24),
  getStat("volume", 720),
  getStat("delivery", 720),
  getStat("chains", 720),
]);

const n = (v) => (v == null || isNaN(+v) ? null : +v);
const fmt = (v) => (v == null ? "—" : v.toLocaleString("en-US"));

const messages24h = n(vol24?.total_messages);
const messages30d = n(vol30d?.total_messages);
const median = n(delivery?.median_delivery_time);
const successRate = n(vol30d?.success_rate);
const activeChains = Array.isArray(chains) ? chains.length : null;

const stats = [
  { label: "MESSAGES (24H)", value: fmt(messages24h) },
  { label: "MESSAGES (30D)", value: fmt(messages30d) },
  { label: "MEDIAN DELIVERY", value: median == null ? "—" : `${Math.round(median)}s`, unit: true },
  { label: "SUCCESS RATE", value: successRate == null ? "—" : `${Math.round(successRate * 100)}%`, emerald: true },
  { label: "ACTIVE CHAINS", value: fmt(activeChains) },
];

// --- SVG ---
const W = 840, H = 190;
const colW = W / stats.length;
const now = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
const FONT = `-apple-system, 'Segoe UI', Ubuntu, Roboto, sans-serif`;

const blocks = stats
  .map((s, i) => {
    const cx = colW * i + colW / 2;
    const valueColor = s.emerald ? "#34D399" : "#00E5E5";
    return `
    <g text-anchor="middle" font-family="${FONT}">
      <text x="${cx}" y="96" font-size="30" font-weight="700" fill="${valueColor}">${s.value}</text>
      <text x="${cx}" y="124" font-size="11" font-weight="600" letter-spacing="1.5" fill="#4A4F5E">${s.label}</text>
    </g>
    ${i > 0 ? `<line x1="${colW * i}" y1="70" x2="${colW * i}" y2="130" stroke="#1E2029" stroke-width="1"/>` : ""}`;
  })
  .join("");

const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="VIA network statistics">
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="14" fill="#0F1117" stroke="#1E2029" stroke-width="2"/>
  <g font-family="${FONT}">
    <circle cx="34" cy="36" r="4" fill="#00E5E5">
      <animate attributeName="opacity" values="1;0.25;1" dur="2s" repeatCount="indefinite"/>
    </circle>
    <text x="48" y="41" font-size="14" font-weight="700" letter-spacing="2" fill="#EFEFF2">VIA NETWORK</text>
    <text x="${W - 30}" y="41" text-anchor="end" font-size="11" fill="#4A4F5E">testnet · updated ${now}</text>
  </g>
  ${blocks}
  <g font-family="${FONT}" text-anchor="middle">
    <text x="${W / 2}" y="${H - 22}" font-size="11" fill="#4A4F5E">live from scan.vialabs.tech</text>
  </g>
</svg>
`;

mkdirSync(new URL("../profile/assets/", import.meta.url).pathname, { recursive: true });
writeFileSync(OUT, svg);
console.log(`Wrote ${OUT}`);
console.log({ messages24h, messages30d, median, successRate, activeChains });