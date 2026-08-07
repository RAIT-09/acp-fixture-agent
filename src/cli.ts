#!/usr/bin/env node
/**
 * CLI entry point. Runs the fixture agent over stdio (newline-delimited
 * JSON-RPC, the ACP stdio transport).
 *
 * IMPORTANT: stdout is reserved for ACP protocol messages. All logging and
 * diagnostics must go to stderr.
 */

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

if (process.argv.includes("--version") || process.argv.includes("-v")) {
	console.log(version);
	process.exit(0);
}

console.error(`acp-fixture-agent ${version}: agent core is not implemented yet.`);
process.exit(1);
