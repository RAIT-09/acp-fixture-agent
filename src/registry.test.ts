import { describe, expect, it } from "vitest";
import {
	findScenario,
	helpText,
	parseCommand,
	toAvailableCommands,
} from "./registry.js";
import type { Scenario } from "./scenario.js";

function fakeScenario(
	overrides: Partial<Scenario> & { name: string },
): Scenario {
	return {
		description: `fake ${overrides.name}`,
		exercises: [],
		run: async () => ({}),
		...overrides,
	};
}

describe("parseCommand", () => {
	it("parses a bare command", () => {
		expect(parseCommand([{ type: "text", text: "/content-all" }])).toEqual({
			name: "content-all",
			args: "",
		});
	});

	it("splits the argument string off the command name", () => {
		expect(
			parseCommand([{ type: "text", text: "/permission allow_always extra" }]),
		).toEqual({ name: "permission", args: "allow_always extra" });
	});

	it("lowercases the command name", () => {
		expect(parseCommand([{ type: "text", text: "/HELP" }])).toEqual({
			name: "help",
			args: "",
		});
	});

	it("trims surrounding whitespace before matching", () => {
		expect(parseCommand([{ type: "text", text: "  /help  " }])).toEqual({
			name: "help",
			args: "",
		});
	});

	it("treats any whitespace, including newlines, as the name/args separator", () => {
		expect(parseCommand([{ type: "text", text: "/usage\n90" }])).toEqual({
			name: "usage",
			args: "90",
		});
	});

	it("returns null for ordinary text", () => {
		expect(parseCommand([{ type: "text", text: "hello" }])).toBeNull();
	});

	it("returns null for an empty prompt", () => {
		expect(parseCommand([])).toBeNull();
	});

	it("inspects only the first content block", () => {
		expect(
			parseCommand([
				{ type: "image", data: "aGk=", mimeType: "image/png" },
				{ type: "text", text: "/help" },
			]),
		).toBeNull();
	});

	it("parses a lone slash as an empty command name", () => {
		expect(parseCommand([{ type: "text", text: "/" }])).toEqual({
			name: "",
			args: "",
		});
	});
});

describe("findScenario", () => {
	const scenarios = [
		fakeScenario({ name: "help" }),
		fakeScenario({ name: "usage" }),
	];

	it("finds a scenario by name", () => {
		expect(findScenario(scenarios, "usage")?.name).toBe("usage");
	});

	it("returns undefined for unknown names", () => {
		expect(findScenario(scenarios, "nope")).toBeUndefined();
	});
});

describe("toAvailableCommands", () => {
	it("maps hint-less scenarios to an explicit null input", () => {
		expect(toAvailableCommands([fakeScenario({ name: "help" })])).toEqual([
			{ name: "help", description: "fake help", input: null },
		]);
	});

	it("maps hints into the input specification", () => {
		expect(
			toAvailableCommands([
				fakeScenario({ name: "usage", hint: "percentage" }),
			]),
		).toEqual([
			{
				name: "usage",
				description: "fake usage",
				input: { hint: "percentage" },
			},
		]);
	});
});

describe("helpText", () => {
	const scenarios = [
		fakeScenario({ name: "help", description: "List scenarios" }),
		fakeScenario({
			name: "usage",
			description: "Report usage",
			hint: "percentage",
		}),
	];

	it("lists every scenario with its usage form", () => {
		const text = helpText(scenarios);
		expect(text).toContain("- `/help` — List scenarios");
		expect(text).toContain("- `/usage <percentage>` — Report usage");
	});
});
