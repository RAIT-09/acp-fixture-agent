import type { PromptRequest } from "@agentclientprotocol/sdk";
import { methods } from "@agentclientprotocol/sdk";
import { describe, expect, it } from "vitest";
import { createFixtureAgent, type FixtureAgentOptions } from "./agent.js";
import type { Scenario } from "./scenario.js";
import {
	agentTextChunks,
	connectTestClient,
	type TestClient,
} from "./test-harness.js";

function textPrompt(text: string): PromptRequest["prompt"] {
	return [{ type: "text", text }];
}

function connect(options?: FixtureAgentOptions): TestClient {
	return connectTestClient(createFixtureAgent({ delayMs: 0, ...options }));
}

async function newSession(testClient: TestClient): Promise<string> {
	const response = await testClient.connection.agent.request(
		methods.agent.session.new,
		{ cwd: "/", mcpServers: [] },
	);
	return response.sessionId;
}

function sendPrompt(testClient: TestClient, sessionId: string, text: string) {
	return testClient.connection.agent.request(methods.agent.session.prompt, {
		sessionId,
		prompt: textPrompt(text),
	});
}

describe("initialize", () => {
	it("advertises every prompt capability and identifies itself", async () => {
		const testClient = connect();
		const response = await testClient.connection.agent.request(
			methods.agent.initialize,
			{ protocolVersion: 1, clientCapabilities: {} },
		);
		expect(response.protocolVersion).toBe(1);
		expect(response.agentCapabilities?.promptCapabilities).toEqual({
			image: true,
			audio: true,
			embeddedContext: true,
		});
		expect(response.agentInfo?.name).toBe("acp-fixture-agent");
	});
});

describe("session/new", () => {
	it("assigns deterministic session ids", async () => {
		const testClient = connect();
		expect(await newSession(testClient)).toBe("sess_1");
		expect(await newSession(testClient)).toBe("sess_2");
	});

	it("advertises commands only after the response", async () => {
		const scenario: Scenario = {
			name: "fake",
			description: "A fake scenario",
			hint: "input",
			exercises: [],
			run: async () => ({}),
		};
		const testClient = connect({ scenarios: [scenario] });
		const sessionId = await newSession(testClient);
		// The advertisement is scheduled after the response; nothing yet.
		expect(testClient.updates).toHaveLength(0);
		await testClient.waitFor(
			() => testClient.updates.length > 0,
			"commands advertisement",
		);
		expect(testClient.updates[0]).toEqual({
			sessionId,
			update: {
				sessionUpdate: "available_commands_update",
				availableCommands: [
					{
						name: "fake",
						description: "A fake scenario",
						input: { hint: "input" },
					},
				],
			},
		});
	});
});

describe("session/prompt", () => {
	it("dispatches a slash command to its scenario with the argument string", async () => {
		let receivedArgs: string | null = null;
		const scenario: Scenario = {
			name: "fake",
			description: "records its args",
			exercises: [],
			run: async (ctx, args) => {
				receivedArgs = args;
				await ctx.update({
					sessionUpdate: "agent_message_chunk",
					content: { type: "text", text: "ran" },
				});
				return {};
			},
		};
		const testClient = connect({ scenarios: [scenario] });
		const sessionId = await newSession(testClient);
		const response = await sendPrompt(testClient, sessionId, "/fake a b c");
		expect(receivedArgs).toBe("a b c");
		expect(response.stopReason).toBe("end_turn");
		const chunks = testClient.updates.filter(
			(u) => u.update.sessionUpdate === "agent_message_chunk",
		);
		expect(chunks).toHaveLength(1);
	});

	it("propagates a scenario's custom stop reason", async () => {
		const scenario: Scenario = {
			name: "refuse",
			description: "refuses",
			exercises: [],
			run: async () => ({ stopReason: "refusal" }),
		};
		const testClient = connect({ scenarios: [scenario] });
		const sessionId = await newSession(testClient);
		const response = await sendPrompt(testClient, sessionId, "/refuse");
		expect(response.stopReason).toBe("refusal");
	});

	it("echoes non-command input back with guidance", async () => {
		const testClient = connect();
		const sessionId = await newSession(testClient);
		const response = await sendPrompt(testClient, sessionId, "hello");
		expect(response.stopReason).toBe("end_turn");
		const texts = agentTextChunks(testClient);
		expect(texts).toHaveLength(2);
		expect(texts[0]).toContain("> hello");
		expect(texts[1]).toContain("Type `/` to browse test scenarios");
	});

	it("flags unknown commands in the echo reply", async () => {
		const testClient = connect();
		const sessionId = await newSession(testClient);
		const response = await sendPrompt(testClient, sessionId, "/unknown");
		expect(response.stopReason).toBe("end_turn");
		expect(agentTextChunks(testClient).join("")).toContain(
			"Unknown command `/unknown`",
		);
	});

	it("rejects prompts for unknown sessions", async () => {
		const testClient = connect();
		await expect(sendPrompt(testClient, "sess_999", "hello")).rejects.toThrow();
	});

	it("hands out session-scoped ids that continue across turns", async () => {
		const ids: string[] = [];
		const scenario: Scenario = {
			name: "ids",
			description: "records ids",
			exercises: [],
			run: async (ctx) => {
				ids.push(ctx.nextId("call"));
				return {};
			},
		};
		const testClient = connect({ scenarios: [scenario] });
		const sessionId = await newSession(testClient);
		await sendPrompt(testClient, sessionId, "/ids");
		await sendPrompt(testClient, sessionId, "/ids");
		expect(ids).toEqual(["call_1", "call_2"]);
	});
});

describe("session/cancel", () => {
	it("resolves the in-flight prompt with the cancelled stop reason", async () => {
		const scenario: Scenario = {
			name: "loop",
			description: "streams forever",
			exercises: [],
			run: async (ctx) => {
				for (;;) {
					await ctx.delay();
				}
			},
		};
		const testClient = connectTestClient(
			createFixtureAgent({ delayMs: 5, scenarios: [scenario] }),
		);
		const sessionId = await newSession(testClient);
		const promptPromise = sendPrompt(testClient, sessionId, "/loop");
		await new Promise((resolve) => setTimeout(resolve, 10));
		await testClient.connection.agent.notify(methods.agent.session.cancel, {
			sessionId,
		});
		const response = await promptPromise;
		expect(response.stopReason).toBe("cancelled");
	});
});
