import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { run } from '..';

describe(`vue-tsc`, () => {

	it(`typecheck`, async () => {
		const consoleOutput: string[] = [];
		const originalConsoleLog = process.stdout.write;
		const originalArgv = process.argv;
		process.stdout.write = output => {
			consoleOutput.push(String(output).trim());
			return true;
		};
		process.argv = [
			...originalArgv,
			'--build',
			path.resolve(__dirname, '../../../test-workspace/tsc'),
			'--pretty',
			'false',
		];
		try {
			run();
		} catch (err) { }
		process.stdout.write = originalConsoleLog;
		process.argv = originalArgv;
		expect(consoleOutput).toMatchInlineSnapshot(`
			[
			  "test-workspace/tsc/failureFixtures/directives/main.vue(4,6): error TS2339: Property 'notExist' does not exist on type 'CreateComponentPublicInstance<Readonly<ExtractPropTypes<{}>>, { exist: typeof exist; }, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, ... 12 more ..., {}>'.",
			  "test-workspace/tsc/failureFixtures/directives/main.vue(9,6): error TS2339: Property 'notExist' does not exist on type 'CreateComponentPublicInstance<Readonly<ExtractPropTypes<{}>>, { exist: typeof exist; }, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, ... 12 more ..., {}>'.",
			  "test-workspace/tsc/failureFixtures/directives/main.vue(12,2): error TS2578: Unused '@ts-expect-error' directive.",
			]
		`);;
	});
});
