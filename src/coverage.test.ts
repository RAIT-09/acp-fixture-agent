import { describe, expect, it } from "vitest";
import { coverageTable, renderCoverageMarkdown } from "./coverage.js";
import { PROTOCOL_FEATURES } from "./scenario.js";
import { builtinScenarios } from "./scenarios/index.js";

const exercised = new Set(
	builtinScenarios.flatMap((scenario) => [...scenario.exercises]),
);

describe("coverage table", () => {
	it("maps the feature vocabulary one-to-one", () => {
		const ids = coverageTable.map((row) => row.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect([...ids].sort()).toEqual([...PROTOCOL_FEATURES].sort());
	});

	it("marks a row covered exactly when a shipped scenario exercises it", () => {
		for (const row of coverageTable) {
			if (row.status === "covered") {
				expect(
					exercised.has(row.id),
					`covered row "${row.id}" has no exercising scenario`,
				).toBe(true);
			} else {
				expect(
					exercised.has(row.id),
					`row "${row.id}" is exercised by a scenario but not marked covered`,
				).toBe(false);
			}
		}
	});

	it("requires a note on every non-covered row", () => {
		for (const row of coverageTable) {
			if (row.status !== "covered") {
				expect(row.note, `row "${row.id}" needs a note`).toBeTruthy();
			}
		}
	});

	it("renders every row and every exercising scenario", () => {
		const markdown = renderCoverageMarkdown(builtinScenarios);
		for (const row of coverageTable) {
			expect(markdown).toContain(`| ${row.feature} |`);
		}
		for (const scenario of builtinScenarios) {
			if (scenario.exercises.length > 0) {
				expect(markdown).toContain(`\`/${scenario.name}\``);
			}
		}
	});
});
