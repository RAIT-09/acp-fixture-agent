/**
 * Writes COVERAGE.md from the coverage table and the shipped scenario
 * catalog. Run via `npm run generate:coverage`; CI fails when the committed
 * file is stale.
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderCoverageMarkdown } from "../src/coverage.js";
import { builtinScenarios } from "../src/scenarios/index.js";

const target = fileURLToPath(new URL("../COVERAGE.md", import.meta.url));
writeFileSync(target, renderCoverageMarkdown(builtinScenarios));
console.log(`Wrote ${target}`);
