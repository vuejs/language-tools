// @ts-nocheck
import * as fs from 'node:fs';
import * as path from 'node:path';
import { expect, test } from 'vitest';
import { run } from '..';

test(`vue-tsc`, () => {
	const tests = fs.readdirSync(path.resolve(__dirname, '../../../test-workspace/tsc'))
		.filter(dir => dir !== 'tsconfig.json' && dir !== 'shared.d.ts' && dir !== 'petite-vue');
	fs.writeFileSync(
		path.resolve(__dirname, '../../../test-workspace/tsc/tsconfig.json'),
		JSON.stringify(
			{
				include: [],
				references: tests.map(testDir => ({ path: `./${testDir}/tsconfig.json` })),
			},
			undefined,
			'\t',
		),
	);
	expect(
		getTscOutput().sort(),
	).toMatchInlineSnapshot(`
		[
		  "test-workspace/tsc/components_3.4/main.vue(79,11): error TS2345: Argument of type '<T>(__VLS_props: NonNullable<Awaited<typeof __VLS_setup>>["props"], __VLS_ctx?: __VLS_PrettifyLocal<Pick<NonNullable<Awaited<typeof __VLS_setup>>, "attrs" | "emit" | "slots">>, __VLS_exposed?: NonNullable<Awaited<typeof __VLS_setup>>["expose"], __VLS_setup?: Promise<...>) => import("vue3.4").VNode & { __ctx?: Awaite...' is not assignable to parameter of type 'never'.",
		  "test-workspace/tsc/failed_#3632/both.vue(3,1): error TS1109: Expression expected.",
		  "test-workspace/tsc/failed_#3632/both.vue(7,1): error TS1109: Expression expected.",
		  "test-workspace/tsc/failed_#3632/script.vue(3,1): error TS1109: Expression expected.",
		  "test-workspace/tsc/failed_#3632/scriptSetup.vue(3,1): error TS1109: Expression expected.",
		  "test-workspace/tsc/failed_#4569/main.vue(1,41): error TS4025: Exported variable '__VLS_export' has or is using private name 'Props'.",
		  "test-workspace/tsc/failed_#5071/withScript.vue(1,19): error TS1005: ';' expected.",
		  "test-workspace/tsc/failed_#5071/withoutScript.vue(2,26): error TS1005: ';' expected.",
		  "test-workspace/tsc/failed_#5823/main.vue(6,13): error TS1109: Expression expected.",
		  "test-workspace/tsc/failed_directives/main.vue(14,6): error TS2339: Property 'notExist' does not exist on type '{ exist: {}; Comp: () => void; $: ComponentInternalInstance; $data: {}; $props: {}; $attrs: Data; $refs: Data; $slots: Readonly<InternalSlots>; ... 8 more ...; $watch<T extends string | ((...args: any) => any)>(source: T, cb: T extends (...args: any) => infer R ? (args_0: R, args_1: R, args_2: OnCleanup) => any : (a...'.",
		  "test-workspace/tsc/failed_directives/main.vue(17,2): error TS2578: Unused '@ts-expect-error' directive.",
		  "test-workspace/tsc/failed_directives/main.vue(20,2): error TS2578: Unused '@ts-expect-error' directive.",
		  "test-workspace/tsc/failed_directives/main.vue(9,6): error TS2339: Property 'notExist' does not exist on type '{ exist: {}; Comp: () => void; $: ComponentInternalInstance; $data: {}; $props: {}; $attrs: Data; $refs: Data; $slots: Readonly<InternalSlots>; ... 8 more ...; $watch<T extends string | ((...args: any) => any)>(source: T, cb: T extends (...args: any) => infer R ? (args_0: R, args_1: R, args_2: OnCleanup) => any : (a...'.",
		  "test-workspace/tsc/fallthroughAttributes/main.vue(14,2): error TS2578: Unused '@ts-expect-error' directive.",
		  "test-workspace/tsc/fallthroughAttributes/main.vue(16,2): error TS2578: Unused '@ts-expect-error' directive.",
		]
	`);
});

function getTscOutput() {
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
			`typescript/lib/tsc`,
			{ paths: [path.resolve(__dirname, '../../../test-workspace')] },
		);
		run(tscPath);
	}
	catch {}
	process.stdout.write = originalConsoleLog;
	process.argv = originalArgv;
	return consoleOutput;
}
