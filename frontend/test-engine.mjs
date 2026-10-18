import { readFileSync } from "node:fs";
// Import TS via bun
const { createSearchEngine, normalize } = await import("./src/lib/docs/search-engine.ts");
const idx = JSON.parse(readFileSync(".next/server/app/docs/search-index.json.body.txt", "utf8").length ? "" : "{}").entries ?? null;
