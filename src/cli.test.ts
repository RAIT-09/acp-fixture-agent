/**
 * Integration smoke tests: the stdio path is the one seam the in-process
 * harness cannot cover, so these spawn the real CLI (via tsx, so they do
 * not depend on a fresh build) and exercise one round trip.
 */

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

function runCli(
	args: string[],
	stdin?: string,
): Promise<{ stdout: string; code: number | null }> {
	return new Promise((resolve, reject) => {
		const child = spawn(
			process.execPath,
			["--import", "tsx", "src/cli.ts", ...args],
			{ cwd: repoRoot, stdio: ["pipe", "pipe", "pipe"] },
		);
		let stdout = "";
		child.stdout.setEncoding("utf8");
		child.stdout.on("data", (data: string) => {
			stdout += data;
		});
		child.on("error", reject);
		child.on("close", (code) => resolve({ stdout, code }));
		if (stdin !== undefined) {
			child.stdin.write(stdin);
		}
		child.stdin.end();
	});
}

describe("cli", () => {
	it("prints the package version", { timeout: 15000 }, async () => {
		const result = await runCli(["--version"]);
		expect(result.stdout.trim()).toBe(version);
		expect(result.code).toBe(0);
	});

	it("lists the scenario catalog", { timeout: 15000 }, async () => {
		const result = await runCli(["--list-scenarios"]);
		expect(result.stdout).toContain("/help");
		expect(result.stdout).toContain("/content-all");
		expect(result.code).toBe(0);
	});

	it("answers initialize over stdio and exits on stdin EOF", {
		timeout: 15000,
	}, async () => {
		const initialize = `${JSON.stringify({
			jsonrpc: "2.0",
			id: 0,
			method: "initialize",
			params: { protocolVersion: 1, clientCapabilities: {} },
		})}\n`;
		const result = await runCli(["--delay", "0"], initialize);
		expect(result.stdout).toContain('"acp-fixture-agent"');
		expect(result.stdout).toContain('"agentInfo"');
		expect(result.code).toBe(0);
	});
});
