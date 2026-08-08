#!/usr/bin/env node
/**
 * CLI entry point: argument dispatch plus stdio wiring around
 * `createFixtureAgent`. No protocol or scenario logic lives here.
 *
 * In run mode, stdout carries ACP ndJSON protocol messages only; all
 * diagnostics go to stderr. The informational flags (--help, --version,
 * --list-scenarios) never connect to a client, so they print to stdout
 * per CLI convention.
 */

import { createRequire } from "node:module";
import { Readable, Writable } from "node:stream";
import { ndJsonStream } from "@agentclientprotocol/sdk";
import { parseCliArgs } from "./cli-args.js";
import { builtinScenarios, createFixtureAgent } from "./index.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

const USAGE = `acp-fixture-agent — deterministic, scenario-driven ACP agent

Usage:
  acp-fixture-agent [--delay <ms>]    Run as a stdio ACP agent
  acp-fixture-agent --list-scenarios  List the scenario catalog
  acp-fixture-agent --version | -v    Print the version
  acp-fixture-agent --help | -h       Show this help

Options:
  --delay <ms>  Pacing delay between scenario steps (default: 50)
`;

function usageOf(scenario: { name: string; hint?: string }): string {
	return scenario.hint
		? `/${scenario.name} <${scenario.hint}>`
		: `/${scenario.name}`;
}

function runAgent(delayMs: number): void {
	// From here on, stdout is reserved for ACP protocol messages.
	const connection = createFixtureAgent({ delayMs }).connect(
		ndJsonStream(
			Writable.toWeb(process.stdout),
			// Node's web-stream typing disagrees with the DOM lib's over BYOB
			// reader details; the runtime object is a byte stream either way.
			Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>,
		),
	);
	// Exit cleanly when the client closes stdin (never leave an orphan).
	void connection.closed.then(() => process.exit(0));
}

const command = parseCliArgs(process.argv.slice(2));
if (command.kind === "version") {
	console.log(version);
} else if (command.kind === "help") {
	console.log(USAGE);
} else if (command.kind === "list-scenarios") {
	const width = Math.max(
		...builtinScenarios.map((scenario) => usageOf(scenario).length),
	);
	for (const scenario of builtinScenarios) {
		console.log(`${usageOf(scenario).padEnd(width)}  ${scenario.description}`);
	}
} else if (command.kind === "error") {
	console.error(command.message);
	console.error(USAGE);
	process.exit(1);
} else {
	runAgent(command.delayMs);
}
