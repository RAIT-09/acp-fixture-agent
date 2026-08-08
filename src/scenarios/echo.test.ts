import type { PromptRequest } from "@agentclientprotocol/sdk";
import { methods } from "@agentclientprotocol/sdk";
import { describe, expect, it } from "vitest";
import { createFixtureAgent } from "../agent.js";
import {
	agentTextChunks,
	connectTestClient,
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

function sendPrompt(
	testClient: TestClient,
	sessionId: string,
	prompt: PromptRequest["prompt"],
) {
	return testClient.connection.agent.request(methods.agent.session.prompt, {
		sessionId,
		prompt,
	});
}

describe("echo responder", () => {
	it("describes every received content block by type", async () => {
		const testClient = connect();
		const sessionId = await newSession(testClient);
		await sendPrompt(testClient, sessionId, [
			{ type: "text", text: "hello world" },
			{ type: "image", data: "aGVsbG8=", mimeType: "image/png" },
			{ type: "resource_link", uri: "file:///note.md", name: "note.md" },
		]);
		const text = agentTextChunks(testClient).join("");
		expect(text).toContain("> hello world");
		expect(text).toContain("- [image image/png, 8 base64 chars]");
		expect(text).toContain("- [resource_link file:///note.md]");
	});

	it("handles an empty prompt", async () => {
		const testClient = connect();
		const sessionId = await newSession(testClient);
		await sendPrompt(testClient, sessionId, []);
		expect(agentTextChunks(testClient).join("")).toContain("(empty prompt)");
	});
});
