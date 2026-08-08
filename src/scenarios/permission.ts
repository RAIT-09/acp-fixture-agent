/**
 * Permission scenarios. `session/request_permission` is the one agent→client
 * request in a session, and the client side has the most moving parts
 * (banner UI, queueing, cancellation). Real agents cannot produce specific
 * option kinds or simultaneous requests on demand; these scenarios can.
 */

import type { PermissionOption } from "@agentclientprotocol/sdk";
import type { Scenario } from "../scenario.js";

const ALL_KINDS = [
	"allow_once",
	"allow_always",
	"reject_once",
	"reject_always",
] as const;
type Kind = (typeof ALL_KINDS)[number];

const OPTION_LABELS: Record<Kind, string> = {
	allow_once: "Allow once",
	allow_always: "Always allow",
	reject_once: "Reject once",
	reject_always: "Always reject",
};

function isKind(token: string): token is Kind {
	return (ALL_KINDS as readonly string[]).includes(token);
}

/** Option ids are the kind names themselves — deterministic, and E2E logs
 *  show at a glance which button was pressed. */
function optionsFor(kinds: readonly Kind[]): PermissionOption[] {
	return kinds.map((kind) => ({
		optionId: kind,
		name: OPTION_LABELS[kind],
		kind,
	}));
}

function isAllowKind(optionId: string): boolean {
	return optionId === "allow_once" || optionId === "allow_always";
}

const permission: Scenario = {
	name: "permission",
	description: "Request permission with selectable option kinds",
	hint: "allow_once allow_always reject_once reject_always (default: all)",
	exercises: ["permissions", "tool_calls"],
	run: async (ctx, args) => {
		const tokens = args.split(/[\s,]+/).filter(Boolean);
		const invalid = tokens.filter((token) => !isKind(token));
		if (invalid.length > 0) {
			await ctx.update({
				sessionUpdate: "agent_message_chunk",
				content: {
					type: "text",
					text: `Unknown permission kind(s): ${invalid.join(", ")}. Valid kinds: ${ALL_KINDS.join(", ")}.`,
				},
			});
			return {};
		}
		const requested = tokens.filter(isKind);
		const kinds = requested.length > 0 ? requested : [...ALL_KINDS];
		const toolCallId = ctx.nextId("call");
		// Official etiquette: the referenced tool call exists before the
		// permission request (the orphan scenario is the deliberate exception).
		await ctx.update({
			sessionUpdate: "tool_call",
			toolCallId,
			title: "Waiting for your decision",
			kind: "edit",
			status: "pending",
			rawInput: { requestedKinds: kinds },
		});
		const response = await ctx.requestPermission({
			toolCall: { toolCallId },
			options: optionsFor(kinds),
		});
		if (response.outcome.outcome !== "selected") {
			// A cancelled outcome means the turn was cancelled: stop quietly.
			return { stopReason: "cancelled" };
		}
		const allowed = isAllowKind(response.outcome.optionId);
		await ctx.update({
			sessionUpdate: "tool_call_update",
			toolCallId,
			status: allowed ? "completed" : "failed",
		});
		await ctx.delay();
		await ctx.update({
			sessionUpdate: "agent_message_chunk",
			content: {
				type: "text",
				text: `You selected \`${response.outcome.optionId}\`. The tool call was marked ${allowed ? "completed" : "failed"} accordingly.`,
			},
		});
		return {};
	},
};

const permissionQueue: Scenario = {
	name: "permission-queue",
	description: "Fire two permission requests at once to exercise queueing",
	exercises: ["permissions", "tool_calls"],
	run: async (ctx) => {
		const first = ctx.nextId("call");
		const second = ctx.nextId("call");
		await ctx.update({
			sessionUpdate: "tool_call",
			toolCallId: first,
			title: "First queued decision",
			kind: "edit",
			status: "pending",
		});
		await ctx.update({
			sessionUpdate: "tool_call",
			toolCallId: second,
			title: "Second queued decision",
			kind: "edit",
			status: "pending",
		});
		// Both requests are created before either resolves; the send order
		// (first, then second) is deterministic.
		const [firstResponse, secondResponse] = await Promise.all([
			ctx.requestPermission({
				toolCall: { toolCallId: first },
				options: optionsFor(["allow_once", "reject_once"]),
			}),
			ctx.requestPermission({
				toolCall: { toolCallId: second },
				options: optionsFor(["allow_once", "reject_once"]),
			}),
		]);
		if (
			firstResponse.outcome.outcome !== "selected" ||
			secondResponse.outcome.outcome !== "selected"
		) {
			return { stopReason: "cancelled" };
		}
		const results: string[] = [];
		for (const [toolCallId, outcome] of [
			[first, firstResponse.outcome],
			[second, secondResponse.outcome],
		] as const) {
			const allowed = isAllowKind(outcome.optionId);
			await ctx.update({
				sessionUpdate: "tool_call_update",
				toolCallId,
				status: allowed ? "completed" : "failed",
			});
			results.push(`${toolCallId}: ${outcome.optionId}`);
		}
		await ctx.delay();
		await ctx.update({
			sessionUpdate: "agent_message_chunk",
			content: {
				type: "text",
				text: `Both decisions resolved — ${results.join(", ")}. Your client should have shown them one at a time (queued), not stacked or dropped.`,
			},
		});
		return {};
	},
};

const permissionOrphan: Scenario = {
	name: "permission-orphan",
	description: "Request permission for a tool call that was never announced",
	exercises: ["permissions"],
	run: async (ctx) => {
		const response = await ctx.requestPermission({
			toolCall: {
				toolCallId: ctx.nextId("orphan"),
				title: "Orphan permission (no prior tool_call event)",
			},
			options: optionsFor(["allow_once", "reject_once"]),
		});
		if (response.outcome.outcome !== "selected") {
			return { stopReason: "cancelled" };
		}
		await ctx.update({
			sessionUpdate: "agent_message_chunk",
			content: {
				type: "text",
				text:
					`You selected \`${response.outcome.optionId}\` on a permission request whose tool call was never announced. ` +
					"If your client crashed or showed nothing, it assumes the referenced tool call exists; official adapters always emit it first, but the spec does not require that.",
			},
		});
		return {};
	},
};

export const permissionScenarios: readonly Scenario[] = [
	permission,
	permissionQueue,
	permissionOrphan,
];
