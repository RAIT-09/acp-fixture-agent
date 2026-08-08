import { Buffer } from "node:buffer";
import type { SessionUpdate } from "@agentclientprotocol/sdk";
import { methods } from "@agentclientprotocol/sdk";
import { describe, expect, it } from "vitest";
import { createFixtureAgent } from "../agent.js";
import {
	connectTestClient,
	scenarioUpdateTypes,
	type TestClient,
} from "../test-harness.js";

function connect(): TestClient {
	return connectTestClient(createFixtureAgent({ delayMs: 0 }));
}

async function newSession(testClient: TestClient): Promise<string> {
	const response = await testClient.connection.agent.request(
		methods.agent.session.new,
		{ cwd: "/", mcpServers: [] },
	);
	return response.sessionId;
}

async function runCommand(testClient: TestClient, text: string) {
	const sessionId = await newSession(testClient);
	await testClient.connection.agent.request(methods.agent.session.prompt, {
		sessionId,
		prompt: [{ type: "text", text }],
	});
}

type ToolCallEvent = SessionUpdate & {
	sessionUpdate: "tool_call" | "tool_call_update";
};

function toolCallEvents(testClient: TestClient): ToolCallEvent[] {
	return testClient.updates.flatMap((notification) =>
		notification.update.sessionUpdate === "tool_call" ||
		notification.update.sessionUpdate === "tool_call_update"
			? [notification.update]
			: [],
	);
}

describe("/content-all", () => {
	it("emits every standard content type exactly once, in one tool call", async () => {
		const testClient = connect();
		await runCommand(testClient, "/content-all");
		const events = toolCallEvents(testClient);
		expect(events).toHaveLength(2);
		expect(events[0]?.sessionUpdate).toBe("tool_call");
		expect(events[0]?.status).toBe("in_progress");
		expect(events[1]?.status).toBe("completed");
		expect(events[1]?.toolCallId).toBe(events[0]?.toolCallId);
		const content = events[1]?.content ?? [];
		const kinds = content.map((item) =>
			item.type === "content" ? item.content.type : item.type,
		);
		expect(kinds).toEqual([
			"text",
			"image",
			"audio",
			"resource_link",
			"resource",
			"diff",
		]);
		expect(events[0] && "rawInput" in events[0]).toBe(true);
		expect(events[1] && "rawOutput" in events[1]).toBe(true);
		expect(scenarioUpdateTypes(testClient)).toEqual([
			"tool_call",
			"tool_call_update",
			"agent_message_chunk",
		]);
	});

	it("carries decodable binary payloads", async () => {
		const testClient = connect();
		await runCommand(testClient, "/content-all");
		const content = toolCallEvents(testClient)[1]?.content ?? [];
		const blocks = content.flatMap((item) =>
			item.type === "content" ? [item.content] : [],
		);
		const image = blocks.find((block) => block.type === "image");
		const audio = blocks.find((block) => block.type === "audio");
		expect(image && audio).toBeTruthy();
		if (image?.type === "image") {
			const bytes = Buffer.from(image.data, "base64");
			expect(bytes.subarray(0, 4).toString("hex")).toBe("89504e47");
			// Visibly sized (64x64), not a minimal pixel — IHDR width/height.
			expect(bytes.readUInt32BE(16)).toBe(64);
			expect(bytes.readUInt32BE(20)).toBe(64);
		}
		if (audio?.type === "audio") {
			const bytes = Buffer.from(audio.data, "base64");
			expect(bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
			expect(bytes.subarray(8, 12).toString("ascii")).toBe("WAVE");
		}
	});
});

describe("/content-clear", () => {
	it("splits the probe into survive and clear calls with end-state verdicts", async () => {
		const testClient = connect();
		await runCommand(testClient, "/content-clear");
		const events = toolCallEvents(testClient);
		expect(events).toHaveLength(5);

		// Call 1: every update after the first omits the content key entirely
		// — omission, not an explicit undefined — because that is what
		// "unchanged" means on the wire.
		const survivor = events.filter((event) => event.toolCallId === "call_1");
		expect(survivor).toHaveLength(3);
		expect(survivor[0]?.content).toHaveLength(1);
		expect(survivor[1] && "content" in survivor[1]).toBe(false);
		expect(survivor[1] && "status" in survivor[1]).toBe(false);
		expect(survivor[2]?.status).toBe("completed");
		expect(survivor[2] && "content" in survivor[2]).toBe(false);

		// Call 2: the explicit empty array clears.
		const cleared = events.filter((event) => event.toolCallId === "call_2");
		expect(cleared).toHaveLength(2);
		expect(cleared[0]?.content).toHaveLength(1);
		expect(cleared[1]?.content).toEqual([]);
		expect(cleared[1]?.status).toBe("completed");
		expect(scenarioUpdateTypes(testClient)).toEqual([
			"tool_call",
			"tool_call_update",
			"tool_call_update",
			"tool_call",
			"tool_call_update",
			"agent_message_chunk",
		]);
	});
});

describe("/content-resend", () => {
	it("re-sends the same collection, then the grown one", async () => {
		const testClient = connect();
		await runCommand(testClient, "/content-resend");
		const events = toolCallEvents(testClient);
		expect(events).toHaveLength(3);
		expect(events[1]?.content).toEqual(events[0]?.content);
		expect(events[2]?.content).toHaveLength(3);
		expect(events[2]?.status).toBe("completed");
		expect(scenarioUpdateTypes(testClient)).toEqual([
			"tool_call",
			"tool_call_update",
			"tool_call_update",
			"agent_message_chunk",
		]);
	});
});
