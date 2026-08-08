import { Buffer } from "node:buffer";
import type { SessionUpdate } from "@agentclientprotocol/sdk";
import { methods } from "@agentclientprotocol/sdk";
import { describe, expect, it } from "vitest";
import { createFixtureAgent } from "../agent.js";
import { connectTestClient, type TestClient } from "../test-harness.js";

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
	it("omits the content key entirely before clearing with an empty array", async () => {
		const testClient = connect();
		await runCommand(testClient, "/content-clear");
		const events = toolCallEvents(testClient);
		expect(events).toHaveLength(3);
		expect(events[0]?.content).toHaveLength(1);
		// The middle update must not carry the keys at all — omission, not
		// an explicit undefined — because that is what "unchanged" means on
		// the wire.
		expect(events[1] && "content" in events[1]).toBe(false);
		expect(events[1] && "status" in events[1]).toBe(false);
		expect(events[2]?.content).toEqual([]);
		expect(events[2]?.status).toBe("completed");
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
	});
});
