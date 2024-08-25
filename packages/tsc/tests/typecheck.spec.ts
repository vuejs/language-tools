import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { run } from '..';

describe(`vue-tsc`, () => {

	it(`typecheck`, async () => {
		const consoleOutput: string[] = [];
		const originalConsoleLog = process.stdout.write;
		const originalArgv = process.argv;
		process.stdout.write = output => {
			consoleOutput.push(output);
			return true;
		};
		process.argv = [
			...originalArgv,
			'--build',
			path.resolve(__dirname, '../../../test-workspace/tsc'),
		];
		try {
			run();
		} catch (err) { }
		process.stdout.write = originalConsoleLog;
		process.argv = originalArgv;
		expect(consoleOutput).toMatchInlineSnapshot(`
			[
			  "[96mtest-workspace/tsc/failureFixtures/directives/main.vue[0m:[93m4[0m:[93m6[0m - [91merror[0m[90m TS2339: [0mProperty 'notExist' does not exist on type 'CreateComponentPublicInstance<Readonly<ExtractPropTypes<{}>>, { exist: typeof exist; }, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, ... 12 more ..., {}>'.

			[7m4[0m   {{ notExist }}
			[7m [0m [91m     ~~~~~~~~[0m

			",
			  "[96mtest-workspace/tsc/failureFixtures/directives/main.vue[0m:[93m9[0m:[93m6[0m - [91merror[0m[90m TS2339: [0mProperty 'notExist' does not exist on type 'CreateComponentPublicInstance<Readonly<ExtractPropTypes<{}>>, { exist: typeof exist; }, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, ... 12 more ..., {}>'.

			[7m9[0m   {{ notExist }}
			[7m [0m [91m     ~~~~~~~~[0m

			",
			  "[96mtest-workspace/tsc/failureFixtures/directives/main.vue[0m:[93m12[0m:[93m2[0m - [91merror[0m[90m TS2578: [0mUnused '@ts-expect-error' directive.

			[7m12[0m  <!-- @vue-expect-error -->
			[7m  [0m [91m ~~~~~~~~~~~~~~~~~~~~~~~~~~[0m

			",
			  "
			Found 3 errors.

			",
			]
		`);;
	}, 2_000_000);
});
