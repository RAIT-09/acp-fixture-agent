/**
 * Status scenarios — the two real-world traps around tool-call status:
 * clients that substitute a default when an update omits status (bouncing
 * calls back to pending), and clients that assume every call walks the
 * pending → in_progress → terminal lifecycle (real agents emit born-terminal
 * calls during history replay and error reporting).
 */

import type { ToolCallContent } from "@agentclientprotocol/sdk";
import type { Scenario } from "../scenario.js";

function step(text: string): ToolCallContent {
	return { type: "content", content: { type: "text", text } };
}

const statusLess: Scenario = {
	name: "status-less",
	description:
		"Stream content updates that omit status; the call must stay in progress",
	exercises: ["tool_calls", "tool_call_status", "tool_call_content"],
	run: async (ctx) => {
		const toolCallId = ctx.nextId("call");
		await ctx.update({
			sessionUpdate: "tool_call",
			toolCallId,
			title: "Status survives status-less updates",
			kind: "other",
			status: "in_progress",
			content: [step("Step 1 running…")],
		});
		await ctx.delay();
		// Content-only update, exactly how streaming agents report progress.
		// No status key: the call must stay in_progress.
		await ctx.update({
			sessionUpdate: "tool_call_update",
			toolCallId,
			content: [step("Step 1 done."), step("Step 2 running…")],
		});
		await ctx.delay();
		await ctx.update({
			sessionUpdate: "tool_call_update",
			toolCallId,
			status: "completed",
			content: [step("Step 1 done."), step("Step 2 done.")],
		});
		await ctx.delay();
		await ctx.update({
			sessionUpdate: "agent_message_chunk",
			content: {
				type: "text",
				text:
					"Expected: the tool call stayed 'in progress' through the middle update and only then completed. " +
					"If it bounced back to pending mid-way, your client substitutes a default when status is omitted.",
			},
		});
		return {};
	},
};

const completedAtBirth: Scenario = {
	name: "completed-at-birth",
	description:
		"Emit tool calls that are already completed or failed on first sight",
	exercises: ["tool_calls", "tool_call_status"],
	run: async (ctx) => {
		await ctx.update({
			sessionUpdate: "tool_call",
			toolCallId: ctx.nextId("call"),
			title: "Born completed (as in history replay)",
			kind: "read",
			status: "completed",
			content: [step("This call never went through pending or in_progress.")],
			rawOutput: { note: "terminal from the start" },
		});
		await ctx.delay();
		await ctx.update({
			sessionUpdate: "tool_call",
			toolCallId: ctx.nextId("call"),
			title: "Born failed (as in MCP startup errors)",
			kind: "other",
			status: "failed",
			content: [step("This call failed before any lifecycle event.")],
		});
		await ctx.delay();
		await ctx.update({
			sessionUpdate: "agent_message_chunk",
			content: {
				type: "text",
				text:
					"Expected: two tool calls shown with terminal statuses (completed, failed) and no lifecycle transitions. " +
					"Real agents do this during history replay and when reporting startup errors.",
			},
		});
		return {};
	},
};

export const statusScenarios: readonly Scenario[] = [
	statusLess,
	completedAtBirth,
];
