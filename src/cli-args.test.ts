import { describe, expect, it } from "vitest";
import { parseCliArgs } from "./cli-args.js";

describe("parseCliArgs", () => {
	it("defaults to run mode with a 50ms delay", () => {
		expect(parseCliArgs([])).toEqual({ kind: "run", delayMs: 50 });
	});

	it("accepts --delay including zero", () => {
		expect(parseCliArgs(["--delay", "0"])).toEqual({ kind: "run", delayMs: 0 });
		expect(parseCliArgs(["--delay", "200"])).toEqual({
			kind: "run",
			delayMs: 200,
		});
	});

	it("rejects invalid --delay values", () => {
		expect(parseCliArgs(["--delay", "-1"]).kind).toBe("error");
		expect(parseCliArgs(["--delay", "abc"]).kind).toBe("error");
		expect(parseCliArgs(["--delay"]).kind).toBe("error");
	});

	it("recognizes the informational flags", () => {
		expect(parseCliArgs(["--version"]).kind).toBe("version");
		expect(parseCliArgs(["-v"]).kind).toBe("version");
		expect(parseCliArgs(["--help"]).kind).toBe("help");
		expect(parseCliArgs(["-h"]).kind).toBe("help");
		expect(parseCliArgs(["--list-scenarios"]).kind).toBe("list-scenarios");
	});

	it("rejects unknown arguments", () => {
		const result = parseCliArgs(["--bogus"]);
		expect(result.kind).toBe("error");
		if (result.kind === "error") {
			expect(result.message).toContain("--bogus");
		}
	});
});
