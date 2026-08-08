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

describe("/help", () => {
	it("lists the catalog, including itself", async () => {
		const testClient = connect();
		const sessionId = await newSession(testClient);
		await testClient.connection.agent.request(methods.agent.session.prompt, {
			sessionId,
			prompt: [{ type: "text", text: "/help" }],
		});
		const text = agentTextChunks(testClient).join("");
		expect(text).toContain("# acp-fixture-agent scenarios");
		expect(text).toContain("- `/help` — List every scenario");
	});

	it("is advertised in the default catalog", async () => {
		const testClient = connect();
		await newSession(testClient);
		await testClient.waitFor(
			() => testClient.updates.length > 0,
			"commands advertisement",
		);
		const advertisement = testClient.updates[0]?.update;
		expect(advertisement?.sessionUpdate).toBe("available_commands_update");
		if (advertisement?.sessionUpdate === "available_commands_update") {
			expect(
				advertisement.availableCommands.map((command) => command.name),
			).toContain("help");
		}
	});
});
