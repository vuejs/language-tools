import * as path from 'path';
import { describe, expect, test } from 'vitest';
import { run } from '..';

describe(`vue-tsc`, () => {

	test(`TypeScript - Stable`, () => {
		expect(
			getTscOutput('stable')
		).toMatchInlineSnapshot(`
			[
			  "test-workspace/tsc/failureFixtures/directives/main.vue(4,6): error TS2339: Property 'notExist' does not exist on type 'CreateComponentPublicInstanceWithMixins<ToResolvedProps<{}, {}>, { exist: typeof exist; }, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, ... 18 more ..., {}>'.",
			  "test-workspace/tsc/failureFixtures/directives/main.vue(9,6): error TS2339: Property 'notExist' does not exist on type 'CreateComponentPublicInstanceWithMixins<ToResolvedProps<{}, {}>, { exist: typeof exist; }, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, ... 18 more ..., {}>'.",
			  "test-workspace/tsc/failureFixtures/directives/main.vue(12,2): error TS2578: Unused '@ts-expect-error' directive.",
			]
		`);
	});

	const isUpdateEvent = process.env.npm_lifecycle_event === 'test:update';
	const isGithubActions = !!process.env.GITHUB_ACTIONS;

	test.skipIf(!isUpdateEvent && isGithubActions)(`TypeScript - Next`, () => {
		expect(
			getTscOutput('next')
		).toMatchInlineSnapshot(`
			[
			  "test-workspace/tsc/failureFixtures/directives/main.vue(4,6): error TS2339: Property 'notExist' does not exist on type 'CreateComponentPublicInstanceWithMixins<ToResolvedProps<{}, {}>, { exist: typeof exist; }, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, ... 18 more ..., {}>'.",
			  "test-workspace/tsc/failureFixtures/directives/main.vue(9,6): error TS2339: Property 'notExist' does not exist on type 'CreateComponentPublicInstanceWithMixins<ToResolvedProps<{}, {}>, { exist: typeof exist; }, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, ... 18 more ..., {}>'.",
			  "test-workspace/tsc/failureFixtures/directives/main.vue(12,2): error TS2578: Unused '@ts-expect-error' directive.",
			  "test-workspace/tsc/passedFixtures/#3373/tsconfig.json(4,3): error TS5102: Option 'importsNotUsedAsValues' has been removed. Please remove it from your configuration.
			  Use 'verbatimModuleSyntax' instead.",
			]
		`);
	});
});

function getTscOutput(tsVersion: 'stable' | 'next') {
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
		const tscPath = require.resolve(
			`typescript-${tsVersion}/lib/tsc`,
			{ paths: [path.resolve(__dirname, '../../../test-workspace')] }
		);
		run(tscPath);
	} catch (err) { }
	process.stdout.write = originalConsoleLog;
	process.argv = originalArgv;
	return consoleOutput;
}
