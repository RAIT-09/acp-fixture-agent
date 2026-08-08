import type { SessionUpdate } from "@agentclientprotocol/sdk";
import { methods } from "@agentclientprotocol/sdk";
import { describe, expect, it } from "vitest";
import { createFixtureAgent } from "../agent.js";
import {
	agentTextChunks,
	connectTestClient,
	scenarioUpdateTypes,
	type TestClient,
} from "../test-harness.js";

function connect(): TestClient {
	return connectTestClient(createFixtureAgent({ delayMs: 0 }));
}

async function runCommand(testClient: TestClient, text: string) {
	const response = await testClient.connection.agent.request(
		methods.agent.session.new,
		{ cwd: "/", mcpServers: [] },
	);
	return await testClient.connection.agent.request(
		methods.agent.session.prompt,
		{
			sessionId: response.sessionId,
			prompt: [{ type: "text", text }],
		},
	);
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

describe("/permission", () => {
	it("offers all four kinds by default and reflects the selection", async () => {
		const testClient = connect();
		await runCommand(testClient, "/permission");
		expect(testClient.permissionRequests).toHaveLength(1);
		expect(
			testClient.permissionRequests[0]?.options.map((option) => option.kind),
		).toEqual(["allow_once", "allow_always", "reject_once", "reject_always"]);
		// The default responder selects the first option (allow_once).
		const events = toolCallEvents(testClient);
		expect(events[0]?.status).toBe("pending");
		expect(events[1]?.status).toBe("completed");
		expect(agentTextChunks(testClient).join("")).toContain("`allow_once`");
		expect(scenarioUpdateTypes(testClient)).toEqual([
			"tool_call",
			"tool_call_update",
			"agent_message_chunk",
		]);
	});

	it("filters options by the argument and marks rejections failed", async () => {
		const testClient = connect();
		// Select by kind, never by hard-coded optionId position.
		testClient.respondToPermission((request) => {
			const option = request.options.find(
				(candidate) => candidate.kind === "reject_always",
			);
			return {
				outcome: {
					outcome: "selected",
					optionId: option?.optionId ?? "",
				},
			};
		});
		await runCommand(testClient, "/permission reject_always");
		expect(testClient.permissionRequests[0]?.options).toHaveLength(1);
		const events = toolCallEvents(testClient);
		expect(events[1]?.status).toBe("failed");
	});

	it("diagnoses invalid kinds without requesting permission", async () => {
		const testClient = connect();
		await runCommand(testClient, "/permission bogus");
		expect(testClient.permissionRequests).toHaveLength(0);
		expect(agentTextChunks(testClient).join("")).toContain(
			"Unknown permission kind",
		);
		expect(scenarioUpdateTypes(testClient)).toEqual(["agent_message_chunk"]);
	});

	it("stops with the cancelled reason on a cancelled outcome", async () => {
		const testClient = connect();
		testClient.respondToPermission(() => ({
			outcome: { outcome: "cancelled" },
		}));
		const response = await runCommand(testClient, "/permission");
		expect(response.stopReason).toBe("cancelled");
		// Only the initial pending tool_call; no terminal update was sent.
		expect(toolCallEvents(testClient)).toHaveLength(1);
		expect(scenarioUpdateTypes(testClient)).toEqual(["tool_call"]);
	});
});

describe("/permission-queue", () => {
	it("sends two requests referencing separate announced tool calls", async () => {
		const testClient = connect();
		await runCommand(testClient, "/permission-queue");
		expect(testClient.permissionRequests).toHaveLength(2);
		expect(
			testClient.permissionRequests.map(
				(request) => request.toolCall.toolCallId,
			),
		).toEqual(["call_1", "call_2"]);
		const terminal = toolCallEvents(testClient).filter(
			(event) => event.sessionUpdate === "tool_call_update",
		);
		expect(terminal.map((event) => event.status)).toEqual([
			"completed",
			"completed",
		]);
		expect(agentTextChunks(testClient).join("")).toContain(
			"call_1: allow_once, call_2: allow_once",
		);
		expect(scenarioUpdateTypes(testClient)).toEqual([
			"tool_call",
			"tool_call",
			"tool_call_update",
			"tool_call_update",
			"agent_message_chunk",
		]);
	});
});

describe("/permission-orphan", () => {
	it("requests permission without ever announcing the tool call", async () => {
		const testClient = connect();
		await runCommand(testClient, "/permission-orphan");
		expect(testClient.permissionRequests).toHaveLength(1);
		expect(testClient.permissionRequests[0]?.toolCall.toolCallId).toBe(
			"orphan_1",
		);
		expect(toolCallEvents(testClient)).toHaveLength(0);
		expect(scenarioUpdateTypes(testClient)).toEqual(["agent_message_chunk"]);
	});
});
