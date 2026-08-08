/**
 * Content scenarios — the reason this project exists. Real agents rarely
 * (audio: never, as of the official adapters) emit most standard tool-call
 * content types, so clients cannot verify their rendering against them.
 * These scenarios produce every type on demand, plus the update-patch
 * semantics around the content collection.
 */

import type { ToolCallContent } from "@agentclientprotocol/sdk";
import type { Scenario } from "../scenario.js";

/**
 * 64x64 red/white checkerboard PNG (8px cells), generated once (signature,
 * IHDR dimensions, and IDAT round-trip verified) and embedded. A visible
 * pattern, not a minimal pixel: the fixture's job is letting a human verify
 * "an image rendered" at a glance, and a checkerboard cannot be mistaken
 * for a CSS rectangle.
 */
const CHECKER_PNG =
	"iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAeUlEQVR42u3YsQ0AIAwDQe+/dNggqUkOiZKCq15OJdXe6Xz+PgAAAAAAAMBlgOUfnN4DAAAAAAAApwGUIAAAAAAAAGAPUIIAAAAAAACAPUAJAgAAAAAAAPYAJQgAAAAAAADYA5QgAAAAAAAAYA9QggAAAAAAAMA2gAdFLNLCvrIZHgAAAABJRU5ErkJggg==";

/**
 * Minimal valid WAV (PCM 16-bit mono 8kHz, 44-byte header + 4 silent
 * samples), same generation-and-verification policy as CHECKER_PNG.
 */
const TINY_WAV =
	"UklGRiwAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQgAAAAAAAAAAAAAAA==";

const contentAll: Scenario = {
	name: "content-all",
	description:
		"Emit one tool call carrying every standard content type plus a diff",
	exercises: ["tool_calls", "tool_call_content", "tool_call_status"],
	run: async (ctx) => {
		const toolCallId = ctx.nextId("call");
		await ctx.update({
			sessionUpdate: "tool_call",
			toolCallId,
			title: "Every standard content type",
			kind: "other",
			status: "in_progress",
			rawInput: { scenario: "content-all" },
		});
		await ctx.delay();
		await ctx.update({
			sessionUpdate: "tool_call_update",
			toolCallId,
			status: "completed",
			content: [
				{
					type: "content",
					content: { type: "text", text: "Plain text tool output." },
				},
				{
					type: "content",
					content: { type: "image", data: CHECKER_PNG, mimeType: "image/png" },
				},
				{
					type: "content",
					content: { type: "audio", data: TINY_WAV, mimeType: "audio/wav" },
				},
				{
					type: "content",
					content: {
						type: "resource_link",
						uri: "file:///fixture/report.md",
						name: "report.md",
						mimeType: "text/markdown",
						size: 512,
					},
				},
				{
					type: "content",
					content: {
						type: "resource",
						resource: {
							uri: "file:///fixture/embedded.txt",
							mimeType: "text/plain",
							text: "Embedded resource body.",
						},
					},
				},
				{
					type: "diff",
					path: "/fixture/config.json",
					oldText: '{\n\t"debug": false\n}',
					newText: '{\n\t"debug": true\n}',
				},
			],
			rawOutput: {
				emitted: [
					"text",
					"image",
					"audio",
					"resource_link",
					"resource",
					"diff",
				],
			},
		});
		await ctx.delay();
		await ctx.update({
			sessionUpdate: "agent_message_chunk",
			content: {
				type: "text",
				text: "The tool call above should render 6 entries: text, image, audio, resource_link, resource, and a diff.",
			},
		});
		return {};
	},
};

function textEntry(text: string): ToolCallContent {
	return { type: "content", content: { type: "text", text } };
}

/**
 * Two calls whose FINAL states are the verdicts, so a single look at the
 * finished chat answers both directions. (A one-call version turned out to
 * be unreadable: a client that wrongly clears on omitted content ends in
 * the same empty state as a correct one — the verdict lived only in a
 * transient mid-state.)
 */
const contentClear: Scenario = {
	name: "content-clear",
	description: "Probe omitted-vs-empty content semantics on tool call updates",
	exercises: ["tool_calls", "tool_call_content"],
	run: async (ctx) => {
		// Call 1: omitted content must SURVIVE — sentinel visible at the end.
		const survivor = ctx.nextId("call");
		await ctx.update({
			sessionUpdate: "tool_call",
			toolCallId: survivor,
			title: "Omitted content must SURVIVE",
			kind: "other",
			status: "in_progress",
			content: [
				textEntry(
					"SENTINEL-KEEP: this text must still be visible when the call completes.",
				),
			],
		});
		await ctx.delay();
		// Title-only update: `content` and `status` keys entirely absent.
		await ctx.update({
			sessionUpdate: "tool_call_update",
			toolCallId: survivor,
			title: "Omitted content must SURVIVE (title updated)",
		});
		await ctx.delay();
		// Completes without a content key: the sentinel must remain.
		await ctx.update({
			sessionUpdate: "tool_call_update",
			toolCallId: survivor,
			status: "completed",
		});
		await ctx.delay();
		// Call 2: an explicit empty array must CLEAR — empty at the end.
		const cleared = ctx.nextId("call");
		await ctx.update({
			sessionUpdate: "tool_call",
			toolCallId: cleared,
			title: "Empty array must CLEAR",
			kind: "other",
			status: "in_progress",
			content: [
				textEntry(
					"SENTINEL-CLEAR: this text must be gone when the call completes.",
				),
			],
		});
		await ctx.delay();
		await ctx.update({
			sessionUpdate: "tool_call_update",
			toolCallId: cleared,
			status: "completed",
			content: [],
		});
		await ctx.delay();
		await ctx.update({
			sessionUpdate: "agent_message_chunk",
			content: {
				type: "text",
				text:
					"Expected final state: the first call still shows its SENTINEL-KEEP text " +
					"(if it is empty, your client treats omitted content as a clear), and the second call " +
					"shows no content (if SENTINEL-CLEAR is still visible, your client ignored the explicit empty array).",
			},
		});
		return {};
	},
};

const entryA: ToolCallContent = {
	type: "content",
	content: { type: "text", text: "Entry A" },
};
const entryB: ToolCallContent = {
	type: "content",
	content: { type: "text", text: "Entry B" },
};
const entryC: ToolCallContent = {
	type: "content",
	content: { type: "text", text: "Entry C" },
};

const contentResend: Scenario = {
	name: "content-resend",
	description:
		"Re-send the same content collection; duplicates reveal append bugs",
	exercises: ["tool_calls", "tool_call_content"],
	run: async (ctx) => {
		const toolCallId = ctx.nextId("call");
		await ctx.update({
			sessionUpdate: "tool_call",
			toolCallId,
			title: "Content is replaced, never appended",
			kind: "other",
			status: "in_progress",
			content: [entryA, entryB],
		});
		await ctx.delay();
		// The same collection again — a cumulative re-send, as streaming
		// agents do. The client must show it once.
		await ctx.update({
			sessionUpdate: "tool_call_update",
			toolCallId,
			content: [entryA, entryB],
		});
		await ctx.delay();
		await ctx.update({
			sessionUpdate: "tool_call_update",
			toolCallId,
			status: "completed",
			content: [entryA, entryB, entryC],
		});
		await ctx.delay();
		await ctx.update({
			sessionUpdate: "agent_message_chunk",
			content: {
				type: "text",
				text: "Expected: exactly three entries (Entry A, Entry B, Entry C). More than three means your client appends content instead of replacing it.",
			},
		});
		return {};
	},
};

export const contentScenarios: readonly Scenario[] = [
	contentAll,
	contentClear,
	contentResend,
];
