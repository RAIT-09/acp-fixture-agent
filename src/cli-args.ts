/**
 * Pure CLI argument parsing. Kept out of cli.ts so it is unit-testable
 * (importing cli.ts runs its side effects).
 */

export type CliCommand =
	| { kind: "run"; delayMs: number }
	| { kind: "version" }
	| { kind: "help" }
	| { kind: "list-scenarios" }
	| { kind: "error"; message: string };

export function parseCliArgs(argv: readonly string[]): CliCommand {
	let delayMs = 50;
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		switch (arg) {
			case "--version":
			case "-v":
				return { kind: "version" };
			case "--help":
			case "-h":
				return { kind: "help" };
			case "--list-scenarios":
				return { kind: "list-scenarios" };
			case "--delay": {
				// Digits only: Number("") is 0 and Number accepts forms like
				// "1e2", so a plain conversion would let those through.
				const rawValue = argv[++i];
				if (rawValue === undefined || !/^\d+$/.test(rawValue)) {
					return {
						kind: "error",
						message: "--delay requires a non-negative integer (milliseconds)",
					};
				}
				delayMs = Number(rawValue);
				break;
			}
			default:
				return { kind: "error", message: `Unknown argument: ${arg}` };
		}
	}
	return { kind: "run", delayMs };
}
