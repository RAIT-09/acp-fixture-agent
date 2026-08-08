/**
 * In-process test harness: a capturing ACP client connected directly to an
 * `AgentApp` (no subprocess, no streams — SDK app-to-app connection).
 *
 * Test-only: excluded from the build output (see tsconfig.build.json). It
 * may graduate to public API if library users want a ready-made capturing
 * client for their own test suites.
 */

import type {
	RequestPermissionRequest,
	RequestPermissionResponse,
	SessionNotification,
} from "@agentclientprotocol/sdk";
import {
	type AgentApp,
	type ClientConnection,
	client,
	type MaybePromise,
	methods,
} from "@agentclientprotocol/sdk";

export type PermissionResponder = (
	request: RequestPermissionRequest,
) => MaybePromise<RequestPermissionResponse>;

export interface TestClient {
	/** All session/update notifications received, in order. */
	updates: SessionNotification[];
	/** All permission requests received, in order. */
	permissionRequests: RequestPermissionRequest[];
	/** The live connection; use `connection.agent` to call agent methods. */
	connection: ClientConnection;
	/** Replace the permission responder (default: select the first option). */
	respondToPermission(responder: PermissionResponder): void;
	/** Poll until the predicate passes; fail after a bounded timeout. */
	waitFor(predicate: () => boolean, label: string): Promise<void>;
}

const WAIT_TIMEOUT_MS = 1000;

/** Extract the text of every agent_message_chunk received so far. */
export function agentTextChunks(testClient: TestClient): string[] {
	return testClient.updates.flatMap((notification) =>
		notification.update.sessionUpdate === "agent_message_chunk" &&
		notification.update.content.type === "text"
			? [notification.update.content.text]
			: [],
	);
}

export function connectTestClient(app: AgentApp): TestClient {
	const updates: SessionNotification[] = [];
	const permissionRequests: RequestPermissionRequest[] = [];
	let permissionResponder: PermissionResponder = (request) => ({
		outcome: {
			outcome: "selected",
			optionId: request.options[0]?.optionId ?? "",
		},
	});

	const connection = client({ name: "fixture-test-client" })
		.onNotification(methods.client.session.update, (ctx) => {
			updates.push(ctx.params);
		})
		.onRequest(methods.client.session.requestPermission, (ctx) => {
			permissionRequests.push(ctx.params);
			return permissionResponder(ctx.params);
		})
		.connect(app);

	return {
		updates,
		permissionRequests,
		connection,
		respondToPermission(responder) {
			permissionResponder = responder;
		},
		waitFor(predicate, label) {
			return new Promise<void>((resolve, reject) => {
				const startedAt = Date.now();
				const poll = () => {
					if (predicate()) {
						resolve();
						return;
					}
					if (Date.now() - startedAt > WAIT_TIMEOUT_MS) {
						reject(new Error(`Timed out waiting for ${label}`));
						return;
					}
					setTimeout(poll, 0);
				};
				poll();
			});
		},
	};
}
