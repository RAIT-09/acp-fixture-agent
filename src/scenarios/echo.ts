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
	const intro = parsed ? `Unknown command \`/${parsed.name}\`.\n\n` : "";
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
