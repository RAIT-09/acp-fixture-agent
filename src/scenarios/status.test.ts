import type { SessionUpdate } from "@agentclientprotocol/sdk";
import { methods } from "@agentclientprotocol/sdk";
import { describe, expect, it } from "vitest";
import { createFixtureAgent } from "../agent.js";
import { connectTestClient, type TestClient } from "../test-harness.js";

function connect(): TestClient {
	return connectTestClient(createFixtureAgent({ delayMs: 0 }));
}

async function runCommand(testClient: TestClient, text: string) {
	const response = await testClient.connection.agent.request(
		methods.agent.session.new,
		{ cwd: "/", mcpServers: [] },
	);
	await testClient.connection.agent.request(methods.agent.session.prompt, {
		sessionId: response.sessionId,
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

describe("/status-less", () => {
	it("streams a status-less update and never completes the call", async () => {
		const testClient = connect();
		await runCommand(testClient, "/status-less");
		const events = toolCallEvents(testClient);
		// Exactly two events — no terminal update exists; the final display
		// state IS the verdict (in_progress = correct, pending = bug).
		expect(events).toHaveLength(2);
		expect(events[0]?.status).toBe("in_progress");
		// The realistic streaming shape: content present, status absent.
		expect(events[1] && "status" in events[1]).toBe(false);
		expect(events[1]?.content).toHaveLength(2);
	});
});

describe("/completed-at-birth", () => {
	it("emits only born-terminal tool_call events, no updates", async () => {
		const testClient = connect();
		await runCommand(testClient, "/completed-at-birth");
		const events = toolCallEvents(testClient);
		expect(events).toHaveLength(2);
		expect(events.every((e) => e.sessionUpdate === "tool_call")).toBe(true);
		expect(events.map((e) => e.status)).toEqual(["completed", "failed"]);
		expect(events.map((e) => e.toolCallId)).toEqual(["call_1", "call_2"]);
	});
});
