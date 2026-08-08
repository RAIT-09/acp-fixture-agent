/**
 * Echo responder for non-command input. Not part of the catalog (it is not
 * an advertised command); the agent core calls it whenever a prompt matches
 * no scenario.
 *
 * It describes every received content block by type, which makes it an
 * instant probe for a client's prompt-sending path: attach an image and the
 * fixture confirms an image arrived. The two-chunk reply doubles as the
 * minimal text-streaming exercise.
 */

import type { PromptRequest } from "@agentclientprotocol/sdk";
import { parseCommand } from "../registry.js";
import type { ScenarioContext, ScenarioOutcome } from "../scenario.js";

export async function runEcho(ctx: ScenarioContext): Promise<ScenarioOutcome> {
	const parsed = parseCommand(ctx.prompt);
	const masked = parsed ? null : findMaskedCommand(ctx.prompt);
	let intro = "";
	if (parsed) {
		intro = `Unknown command \`/${parsed.name}\`.\n\n`;
	} else if (masked) {
		// A real client bug caught in the wild: clients that prepend
		// instruction/context blocks push the command out of the first block,
		// where official adapters (and this fixture) detect it. Diagnose it
		// instead of running the command — leniency would hide the bug.
		intro =
			`Block ${masked.index + 1} looks like the command \`/${masked.name}\`, ` +
			"but commands are only detected in the FIRST content block (matching the official adapters). " +
			`Your client placed ${masked.index} other block(s) before it.\n\n`;
	}
	const received =
		ctx.prompt.length === 0
			? "(empty prompt)"
			: ctx.prompt.map(describeBlock).join("\n");
	await ctx.update({
		sessionUpdate: "agent_message_chunk",
		content: { type: "text", text: `${intro}You sent:\n${received}` },
	});
	await ctx.delay();
	await ctx.update({
		sessionUpdate: "agent_message_chunk",
		content: {
			type: "text",
			text: "\n\nType `/` to browse test scenarios, or run `/help` for the catalog.",
		},
	});
	return {};
}

/**
 * Find the first non-leading text block that parses as a slash command.
 * Reuses parseCommand on a single-block slice so the detection rule stays
 * single-sourced.
 */
function findMaskedCommand(
	prompt: PromptRequest["prompt"],
): { index: number; name: string } | null {
	for (let i = 1; i < prompt.length; i++) {
		const block = prompt[i];
		if (block?.type !== "text") continue;
		const parsed = parseCommand([block]);
		if (parsed) return { index: i, name: parsed.name };
	}
	return null;
}

function describeBlock(block: PromptRequest["prompt"][number]): string {
	switch (block.type) {
		case "text":
			return `> ${block.text}`;
		case "image":
			return `- [image ${block.mimeType}, ${block.data.length} base64 chars]`;
		case "audio":
			return `- [audio ${block.mimeType}, ${block.data.length} base64 chars]`;
		case "resource_link":
			return `- [resource_link ${block.uri}]`;
		case "resource":
			return `- [resource ${block.resource.uri}]`;
		default:
			// Defensive: future ContentBlock variants surface by name.
			return `- [${(block as { type: string }).type}]`;
	}
}
