import * as fs from 'node:fs';
import * as path from 'node:path';
import { expect, test } from 'vitest';
import { runTsc } from './utils';

test(`vue-tsc`, () => {
	const dirPath = path.resolve(__dirname, '..', '..', '..', 'test-workspace', 'tsc');
	const tests = fs.readdirSync(dirPath)
		.filter(dir => fs.existsSync(path.resolve(dirPath, dir, 'tsconfig.json')));

	fs.writeFileSync(
		path.resolve(__dirname, '../../../test-workspace/tsc/tsconfig.json'),
		JSON.stringify(
			{
				include: [],
				references: tests.map(testDir => ({ path: `./${testDir}/tsconfig.json` })),
			},
			undefined,
			'\t',
		) + '\n',
	);

	expect(
		runTsc('tsc').sort(),
	).toMatchInlineSnapshot(`
		[
		  "test-workspace/tsc/_failed_#3632/both.vue(3,1): error TS1109: Expression expected.",
		  "test-workspace/tsc/_failed_#3632/both.vue(7,1): error TS1109: Expression expected.",
		  "test-workspace/tsc/_failed_#3632/script.vue(3,1): error TS1109: Expression expected.",
		  "test-workspace/tsc/_failed_#3632/scriptSetup.vue(3,1): error TS1109: Expression expected.",
		  "test-workspace/tsc/_failed_#4569/main.vue(1,33): error TS4025: Exported variable '__VLS_export' has or is using private name 'Props'.",
		  "test-workspace/tsc/_failed_#5071/withScript.vue(1,19): error TS1005: ';' expected.",
		  "test-workspace/tsc/_failed_#5071/withoutScript.vue(2,26): error TS1005: ';' expected.",
		  "test-workspace/tsc/_failed_#5823/main.vue(6,13): error TS1109: Expression expected.",
		  "test-workspace/tsc/_failed_directives/main.vue(14,6): error TS2339: Property 'notExist' does not exist on type '{ $: ComponentInternalInstance; $data: {}; $props: {}; $attrs: Data; $refs: Data; $slots: Readonly<InternalSlots>; $root: ComponentPublicInstance<...> | null; ... 9 more ...; Comp: () => void; }'.",
		  "test-workspace/tsc/_failed_directives/main.vue(17,2): error TS2578: Unused '@ts-expect-error' directive.",
		  "test-workspace/tsc/_failed_directives/main.vue(20,2): error TS2578: Unused '@ts-expect-error' directive.",
		  "test-workspace/tsc/_failed_directives/main.vue(9,6): error TS2339: Property 'notExist' does not exist on type '{ $: ComponentInternalInstance; $data: {}; $props: {}; $attrs: Data; $refs: Data; $slots: Readonly<InternalSlots>; $root: ComponentPublicInstance<...> | null; ... 9 more ...; Comp: () => void; }'.",
		  "test-workspace/tsc/_failed_fragment_props/main.vue(6,31): error TS2322: Type '{ id: number; }' is not assignable to type 'PropertyKey | undefined'.",
		  "test-workspace/tsc/_failed_fragment_props/main.vue(9,32): error TS2353: Object literal may only specify known properties, and 'foo' does not exist in type 'HTMLAttributes & ReservedProps'.",
		]
	`);
});
