/**
 * Pure functions over the scenario collection. Everything a client sees
 * about the catalog — the advertised command list, `/help` output, command
 * parsing — derives from the scenario objects through these functions, so
 * the catalog can never drift from the implementation.
 */

import type { AvailableCommand, PromptRequest } from "@agentclientprotocol/sdk";
import type { Scenario } from "./scenario.js";

/** A parsed slash-command invocation. */
export interface ParsedCommand {
	/** Command name without the leading slash, lowercased. */
	name: string;
	/** Everything after the command name, trimmed ("" when absent). */
	args: string;
}

/**
 * Parse a prompt as a slash-command invocation, or return null when it is
 * ordinary input. Per the ACP spec, commands arrive as regular prompts
 * whose text starts with `/`; like the official adapters, only the first
 * content block is inspected.
 */
export function parseCommand(
	prompt: PromptRequest["prompt"],
): ParsedCommand | null {
	const first = prompt[0];
	if (first?.type !== "text") return null;
	const text = first.text.trim();
	if (!text.startsWith("/")) return null;
	const withoutSlash = text.slice(1);
	const spaceIndex = withoutSlash.search(/\s/);
	if (spaceIndex === -1) {
		return { name: withoutSlash.toLowerCase(), args: "" };
	}
	return {
		name: withoutSlash.slice(0, spaceIndex).toLowerCase(),
		args: withoutSlash.slice(spaceIndex + 1).trim(),
	};
}

/** Look up a scenario by command name. */
export function findScenario(
	scenarios: readonly Scenario[],
	name: string,
): Scenario | undefined {
	return scenarios.find((scenario) => scenario.name === name);
}

/** Build the `available_commands_update` payload from the catalog. */
export function toAvailableCommands(
	scenarios: readonly Scenario[],
): AvailableCommand[] {
	return scenarios.map((scenario) => ({
		name: scenario.name,
		description: scenario.description,
		input: scenario.hint ? { hint: scenario.hint } : null,
	}));
}

/** Render the `/help` response body from the catalog. */
export function helpText(scenarios: readonly Scenario[]): string {
	const lines = scenarios.map((scenario) => {
		const usage = scenario.hint
			? `/${scenario.name} <${scenario.hint}>`
			: `/${scenario.name}`;
		return `- \`${usage}\` — ${scenario.description}`;
	});
	return [
		"# acp-fixture-agent scenarios",
		"",
		"Every scenario is a slash command. Type `/` to browse them in your client.",
		"",
		...lines,
		"",
	].join("\n");
}
